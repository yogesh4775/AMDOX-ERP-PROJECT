import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import { WmsService } from "../services/wms.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import {
  CreateWarehouseZoneDto,
  UpdateWarehouseZoneDto,
} from "../dto/zone.dto";
import { CreateWarehouseBinDto, UpdateWarehouseBinDto } from "../dto/bin.dto";
import { CreatePutawayRuleDto } from "../dto/putaway-rule.dto";
import { CreateWarehouseMovementDto } from "../dto/movement.dto";
import { CreateCycleCountDto } from "../dto/cycle-count.dto";

@Controller("wms")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class WmsController {
  constructor(private readonly wmsService: WmsService) {}

  // --- ZONES ---
  @Post("zones")
  @Permissions("wms:zone:write")
  async createZone(
    @Body() dto: CreateWarehouseZoneDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.createZone(req.user.tenantId!, dto, req.user);
  }

  @Patch("zones/:id")
  @Permissions("wms:zone:write")
  async updateZone(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseZoneDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.updateZone(req.user.tenantId!, id, dto, req.user);
  }

  @Get("zones")
  @Permissions("wms:zone:read")
  async getZones(@Req() req: { user: AuthUser }) {
    return this.wmsService.getZones(req.user.tenantId!);
  }

  // --- BINS ---
  @Post("bins")
  @Permissions("wms:bin:write")
  async createBin(
    @Body() dto: CreateWarehouseBinDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.createBin(req.user.tenantId!, dto, req.user);
  }

  @Patch("bins/:id")
  @Permissions("wms:bin:write")
  async updateBin(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateWarehouseBinDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.updateBin(req.user.tenantId!, id, dto, req.user);
  }

  @Get("bins")
  @Permissions("wms:bin:read")
  async getBins(@Req() req: { user: AuthUser }) {
    return this.wmsService.getBins(req.user.tenantId!);
  }

  @Get("bins/:id/stock")
  @Permissions("wms:bin:read")
  async getBinStock(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.getBinStock(req.user.tenantId!, id);
  }

  // --- PUTAWAY RULES & SUGGESTIONS ---
  @Post("putaway-rules")
  @Permissions("wms:rule:write")
  async createPutawayRule(
    @Body() dto: CreatePutawayRuleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.createPutawayRule(req.user.tenantId!, dto);
  }

  @Get("putaway-rules")
  @Permissions("wms:rule:read")
  async getPutawayRules(@Req() req: { user: AuthUser }) {
    return this.wmsService.getPutawayRules(req.user.tenantId!);
  }

  @Get("putaway-suggestions")
  @Permissions("wms:rule:read")
  async suggestPutaway(
    @Query("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Query("productId", ParseUUIDPipe) productId: string,
    @Query("quantity") quantity: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.suggestPutawayBin(
      req.user.tenantId!,
      warehouseId,
      productId,
      Number(quantity),
    );
  }

  // --- PICK SUGGESTIONS ---
  @Get("pick-suggestions")
  @Permissions("wms:movement:read")
  async suggestPick(
    @Query("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Query("productId", ParseUUIDPipe) productId: string,
    @Query("quantity") quantity: string,
    @Query("strategy") strategy: "FIFO" | "FEFO",
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.suggestPickBins(
      req.user.tenantId!,
      warehouseId,
      productId,
      Number(quantity),
      strategy || "FIFO",
    );
  }

  // --- MOVEMENTS ---
  @Post("movements")
  @Permissions("wms:movement:write")
  async moveStock(
    @Body() dto: CreateWarehouseMovementDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.moveStock(req.user.tenantId!, dto, req.user);
  }

  // --- CYCLE COUNTS ---
  @Post("cycle-counts")
  @Permissions("wms:cycle-count:write")
  async startCycleCount(
    @Body() dto: CreateCycleCountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.startCycleCount(req.user.tenantId!, dto, req.user);
  }

  @Post("cycle-counts/:id/results")
  @Permissions("wms:cycle-count:write")
  async recordCycleCountResults(
    @Param("id", ParseUUIDPipe) id: string,
    @Body("lines")
    lines: { binId: string; productId: string; countedQty: number }[],
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.recordCycleCountResults(
      req.user.tenantId!,
      id,
      lines,
      req.user,
    );
  }

  @Post("cycle-counts/:id/approve")
  @Permissions("wms:cycle-count:approve")
  async approveCycleCount(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.wmsService.approveCycleCount(req.user.tenantId!, id, req.user);
  }

  // --- REPORT EXPORTS ---
  @Get("reports/export/csv")
  @Permissions("wms:bin:read")
  async exportCSV(@Req() req: { user: AuthUser }) {
    const bins = await this.wmsService.getBins(req.user.tenantId!);
    const csvContent = [
      "ID,Code,Aisle,Rack,Shelf,Position,Status",
      ...bins.map(
        (b) =>
          `"${b.id}","${b.code}","${b.aisle || ""}","${b.rack || ""}","${b.shelf || ""}","${b.position || ""}","${b.status}"`,
      ),
    ].join("\n");
    return { csv: csvContent };
  }

  @Get("reports/export/pdf")
  @Permissions("wms:bin:read")
  async exportPDF(@Req() req: { user: AuthUser }) {
    const bins = await this.wmsService.getBins(req.user.tenantId!);
    return { pdf: Buffer.from(JSON.stringify(bins)).toString("base64") };
  }
}
