import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { FixedAssetsService } from "./fixed-assets.service";
import { CreateAssetCategoryDto } from "./dto/create-asset-category.dto";
import { UpdateAssetCategoryDto } from "./dto/update-asset-category.dto";
import { AcquireAssetDto } from "./dto/acquire-asset.dto";
import { DisposeAssetDto } from "./dto/dispose-asset.dto";
import { TransferAssetDto } from "./dto/transfer-asset.dto";
import { RecordMaintenanceDto } from "./dto/record-maintenance.dto";
import { RunDepreciationDto } from "./dto/run-depreciation.dto";
import { QueryAssetsDto } from "./dto/query-assets.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { AuditService } from "../../common/audit/audit.service";

@Controller("fixed-assets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FixedAssetsController {
  constructor(
    private readonly fixedAssetsService: FixedAssetsService,
    private readonly auditService: AuditService,
  ) {}

  // --- ASSET CATEGORIES ---
  @Post("categories")
  @Permissions(PermissionsList.FIXED_ASSET_CATEGORY_WRITE)
  async createCategory(
    @Body() dto: CreateAssetCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.fixedAssetsService.createCategory(dto, req.user);
  }

  @Get("categories")
  @Permissions(PermissionsList.FIXED_ASSET_CATEGORY_READ)
  async getCategories(@Req() req: { user: AuthUser }) {
    return this.fixedAssetsService.getCategories(req.user);
  }

  @Patch("categories/:id")
  @Permissions(PermissionsList.FIXED_ASSET_CATEGORY_WRITE)
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateAssetCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.fixedAssetsService.updateCategory(id, dto, req.user);
  }

  // --- ASSETS REGISTER ---
  @Post("assets")
  @Permissions(PermissionsList.FIXED_ASSET_ASSET_WRITE)
  async acquireAsset(
    @Body() dto: AcquireAssetDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.fixedAssetsService.acquireAsset(dto, req.user);
  }

  @Get("assets")
  @Permissions(PermissionsList.FIXED_ASSET_ASSET_READ)
  async getAssetRegister(
    @Query() query: QueryAssetsDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const assets = await this.fixedAssetsService.getAssetRegister(
      query,
      req.user,
    );

    if (query.export === "csv") {
      let csv =
        "ID,SKU,Name,Category,Status,Purchase Date,Purchase Cost,Salvage Value,Book Value,Location,Department\n";
      for (const asset of assets) {
        csv += `"${asset.id}","${asset.sku}","${asset.name}","${asset.category.name}","${asset.status}","${asset.purchaseDate.toISOString()}",${asset.purchaseCost},${asset.salvageValue},${asset.bookValue},"${asset.location || ""}","${asset.department || ""}"\n`;
      }

      await this.auditService.log({
        action: "ASSET_REGISTER_EXPORTED",
        entity: "AssetRegister",
        entityId: req.user.tenantId!,
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="asset_register.csv"',
      );
      return res.send(csv);
    }

    if (query.export === "pdf") {
      const pdfLayout = {
        title: "ENTERPRISE ASSET REGISTER REPORT",
        tenantId: req.user.tenantId,
        date: new Date().toISOString(),
        data: assets.map((a) => ({
          sku: a.sku,
          name: a.name,
          category: a.category.name,
          status: a.status,
          purchaseCost: a.purchaseCost.toString(),
          bookValue: a.bookValue.toString(),
        })),
      };

      await this.auditService.log({
        action: "ASSET_REGISTER_EXPORTED",
        entity: "AssetRegister",
        entityId: req.user.tenantId!,
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "pdf" },
      });

      return res.json(pdfLayout);
    }

    return res.json(assets);
  }

  // --- DEPRECIATION ---
  @Post("depreciation/run")
  @Permissions(PermissionsList.FIXED_ASSET_DEPRECIATION_WRITE)
  async runDepreciation(
    @Body() dto: RunDepreciationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.fixedAssetsService.runDepreciation(dto, req.user);
  }

  @Get("depreciation/register")
  @Permissions(PermissionsList.FIXED_ASSET_REPORT_READ)
  async getDepreciationRegister(
    @Req() req: { user: AuthUser },
    @Query("export") exportFormat?: string,
    @Res() res?: Response,
  ) {
    const records = await this.fixedAssetsService.getDepreciationRegister(
      req.user,
    );

    if (exportFormat === "csv" && res) {
      let csv =
        "ID,Asset SKU,Asset Name,Depreciation Date,Amount,Book Value Before,Book Value After,Journal ID\n";
      for (const r of records) {
        csv += `"${r.id}","${r.asset.sku}","${r.asset.name}","${r.depreciationDate.toISOString()}",${r.amount},${r.bookValueBefore},${r.bookValueAfter},"${r.journalEntryId || ""}"\n`;
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="depreciation_register.csv"',
      );
      return res.send(csv);
    }

    if (res) {
      return res.json(records);
    }
    return records;
  }

  // --- TRANSFERS ---
  @Patch("assets/:id/transfer")
  @Permissions(PermissionsList.FIXED_ASSET_ASSET_WRITE)
  async transferAsset(
    @Param("id") id: string,
    @Body() dto: TransferAssetDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.fixedAssetsService.transferAsset(id, dto, req.user);
  }

  // --- MAINTENANCE ---
  @Post("assets/:id/maintenance")
  @Permissions(PermissionsList.FIXED_ASSET_ASSET_WRITE)
  async recordMaintenance(
    @Param("id") id: string,
    @Body() dto: RecordMaintenanceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.fixedAssetsService.recordMaintenance(id, dto, req.user);
  }

  // --- DISPOSAL ---
  @Post("assets/:id/dispose")
  @Permissions(PermissionsList.FIXED_ASSET_ASSET_WRITE)
  async disposeAsset(
    @Param("id") id: string,
    @Body() dto: DisposeAssetDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.fixedAssetsService.disposeAsset(id, dto, req.user);
  }

  // --- REPORTS ---
  @Get("reports/net-book-value")
  @Permissions(PermissionsList.FIXED_ASSET_REPORT_READ)
  async getNetBookValueReport(
    @Req() req: { user: AuthUser },
    @Query("export") exportFormat?: string,
    @Res() res?: Response,
  ) {
    const report = await this.fixedAssetsService.getNetBookValueReport(
      req.user,
    );

    if (exportFormat === "csv" && res) {
      let csv =
        "SKU,Name,Category,Purchase Cost,Accumulated Depreciation,Net Book Value,Status\n";
      for (const r of report) {
        csv += `"${r.sku}","${r.name}","${r.category}",${r.purchaseCost},${r.accumulatedDepreciation},${r.netBookValue},"${r.status}"\n`;
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="net_book_value_report.csv"',
      );
      return res.send(csv);
    }

    if (res) {
      return res.json(report);
    }
    return report;
  }

  @Get("reports/movements")
  @Permissions(PermissionsList.FIXED_ASSET_REPORT_READ)
  async getAssetMovementReport(
    @Req() req: { user: AuthUser },
    @Query("export") exportFormat?: string,
    @Res() res?: Response,
  ) {
    const report = await this.fixedAssetsService.getAssetMovementReport(
      req.user,
    );

    if (exportFormat === "csv" && res) {
      let csv =
        "Transfer ID,SKU,Name,Transfer Date,From Location,To Location,From Department,To Department,Reason\n";
      for (const r of report) {
        csv += `"${r.transferId}","${r.sku}","${r.name}","${r.transferDate.toISOString()}","${r.fromLocation || ""}","${r.toLocation}","${r.fromDepartment || ""}","${r.toDepartment}","${r.reason || ""}"\n`;
      }
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="asset_movements_report.csv"',
      );
      return res.send(csv);
    }

    if (res) {
      return res.json(report);
    }
    return report;
  }

  @Get("dashboard/summary")
  @Permissions(PermissionsList.FIXED_ASSET_REPORT_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.fixedAssetsService.getDashboardSummary(req.user);
  }
}
