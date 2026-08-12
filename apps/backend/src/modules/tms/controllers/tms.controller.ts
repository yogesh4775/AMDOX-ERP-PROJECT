import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { TmsService } from "../services/tms.service";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { CreateVehicleDto, UpdateVehicleDto } from "../dto/vehicle.dto";
import { CreateDriverDto, UpdateDriverDto } from "../dto/driver.dto";
import { CreateCarrierDto, UpdateCarrierDto } from "../dto/carrier.dto";
import {
  CreateShipmentDto,
  RecordPODDto,
  LogExceptionDto,
} from "../dto/shipment.dto";
import {
  CreateTripDto,
  DispatchTripDto,
  CompleteTripDto,
  LogGPSDto,
  LogFuelDto,
  ScheduleMaintenanceDto,
} from "../dto/trip.dto";

@Controller("tms")
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class TmsController {
  constructor(private readonly tmsService: TmsService) {}

  // --- VEHICLES ---
  @Post("vehicles")
  @Permissions("tms:fleet:write")
  async createVehicle(
    @Body() dto: CreateVehicleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.createVehicle(req.user.tenantId!, dto, req.user);
  }

  @Patch("vehicles/:id")
  @Permissions("tms:fleet:write")
  async updateVehicle(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Body() dto: UpdateVehicleDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.updateVehicle(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      dto,
      req.user,
    );
  }

  @Delete("vehicles/:id")
  @Permissions("tms:fleet:write")
  async deleteVehicle(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.deleteVehicle(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      req.user,
    );
  }

  @Get("vehicles")
  @Permissions("tms:fleet:read")
  async getVehicles(@Req() req: { user: AuthUser }) {
    return this.tmsService.getVehicles(req.user.tenantId!);
  }

  // --- DRIVERS ---
  @Post("drivers")
  @Permissions("tms:fleet:write")
  async createDriver(
    @Body() dto: CreateDriverDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.createDriver(req.user.tenantId!, dto, req.user);
  }

  @Patch("drivers/:id")
  @Permissions("tms:fleet:write")
  async updateDriver(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Body() dto: UpdateDriverDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.updateDriver(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      dto,
      req.user,
    );
  }

  @Delete("drivers/:id")
  @Permissions("tms:fleet:write")
  async deleteDriver(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.deleteDriver(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      req.user,
    );
  }

  @Get("drivers")
  @Permissions("tms:fleet:read")
  async getDrivers(@Req() req: { user: AuthUser }) {
    return this.tmsService.getDrivers(req.user.tenantId!);
  }

  // --- CARRIERS ---
  @Post("carriers")
  @Permissions("tms:fleet:write")
  async createCarrier(
    @Body() dto: CreateCarrierDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.createCarrier(req.user.tenantId!, dto, req.user);
  }

  @Patch("carriers/:id")
  @Permissions("tms:fleet:write")
  async updateCarrier(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Body() dto: UpdateCarrierDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.updateCarrier(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      dto,
      req.user,
    );
  }

  @Delete("carriers/:id")
  @Permissions("tms:fleet:write")
  async deleteCarrier(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.deleteCarrier(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      req.user,
    );
  }

  @Get("carriers")
  @Permissions("tms:fleet:read")
  async getCarriers(@Req() req: { user: AuthUser }) {
    return this.tmsService.getCarriers(req.user.tenantId!);
  }

  // --- SHIPMENTS ---
  @Post("shipments")
  @Permissions("tms:shipment:write")
  async createShipment(
    @Body() dto: CreateShipmentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.createShipment(req.user.tenantId!, dto, req.user);
  }

  @Get("shipments")
  @Permissions("tms:shipment:read")
  async getShipments(@Req() req: { user: AuthUser }) {
    return this.tmsService.getShipments(req.user.tenantId!);
  }

  @Post("shipments/:id/stops/:stopId/pod")
  @Permissions("tms:shipment:write")
  async recordPOD(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("stopId", ParseUUIDPipe) stopId: string,
    @Body() dto: RecordPODDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.recordPOD(
      req.user.tenantId!,
      id,
      stopId,
      dto,
      req.user,
    );
  }

  @Post("shipments/:id/exceptions")
  @Permissions("tms:shipment:write")
  async logException(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LogExceptionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.logException(req.user.tenantId!, id, dto, req.user);
  }

  // --- TRIPS ---
  @Post("trips")
  @Permissions("tms:trip:write")
  async createTrip(@Body() dto: CreateTripDto, @Req() req: { user: AuthUser }) {
    return this.tmsService.createTrip(req.user.tenantId!, dto, req.user);
  }

  @Post("trips/:id/dispatch")
  @Permissions("tms:trip:write")
  async dispatchTrip(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Body() dto: DispatchTripDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.dispatchTrip(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      dto,
      req.user,
    );
  }

  @Post("trips/:id/complete")
  @Permissions("tms:trip:write")
  async completeTrip(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("expectedVersion") expectedVersion: string,
    @Body() dto: CompleteTripDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.completeTrip(
      req.user.tenantId!,
      id,
      Number(expectedVersion),
      dto,
      req.user,
    );
  }

  @Post("trips/:id/gps")
  @Permissions("tms:trip:write")
  async logGPS(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LogGPSDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.logGPS(req.user.tenantId!, id, dto, req.user);
  }

  @Get("trips")
  @Permissions("tms:trip:read")
  async getTrips(@Req() req: { user: AuthUser }) {
    return this.tmsService.getTrips(req.user.tenantId!);
  }

  // --- FUEL & MAINTENANCE ---
  @Post("vehicles/:id/fuel")
  @Permissions("tms:fleet:write")
  async logFuel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LogFuelDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.logFuel(req.user.tenantId!, id, dto, req.user);
  }

  @Post("vehicles/:id/maintenance")
  @Permissions("tms:fleet:write")
  async scheduleMaintenance(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ScheduleMaintenanceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.tmsService.scheduleMaintenance(
      req.user.tenantId!,
      id,
      dto,
      req.user,
    );
  }

  // --- REPORT EXPORTS ---
  @Get("reports/export/csv")
  @Permissions("tms:fleet:read")
  async exportCSV(@Req() req: { user: AuthUser }) {
    const vehicles = await this.tmsService.getVehicles(req.user.tenantId!);
    const csvContent = [
      "ID,LicensePlate,Model,Status",
      ...vehicles.map(
        (v) => `"${v.id}","${v.licensePlate}","${v.model}","${v.status}"`,
      ),
    ].join("\n");
    return { csv: csvContent };
  }

  @Get("reports/export/pdf")
  @Permissions("tms:fleet:read")
  async exportPDF(@Req() req: { user: AuthUser }) {
    const vehicles = await this.tmsService.getVehicles(req.user.tenantId!);
    return { pdf: Buffer.from(JSON.stringify(vehicles)).toString("base64") };
  }
}
