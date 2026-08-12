import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { StockService } from "../../inventory/stock.service";
import { AccountingService } from "../../accounting/accounting.service";
import {
  WorkflowService,
  WorkflowInstanceStatus,
} from "../../workflow/services/workflow.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../../common/transactions/transaction.helper";
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
import { NotificationType } from "../../notifications/dto/query-notification.dto";
import {
  Prisma,
  Vehicle,
  Driver,
  Carrier,
  Shipment,
  Trip,
  VehicleStatus,
  DriverStatus,
  ShipmentStatus,
  ShipmentSourceType,
  TripStatus,
  StopStatus,
  MaintenanceStatus,
  AccountType,
  JournalSourceType,
  InspectionLotStatus,
  InspectionLotType,
} from "@amdox/database/generated";
import * as crypto from "crypto";

@Injectable()
export class TmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly stockService: StockService,
    private readonly accountingService: AccountingService,
    private readonly workflowService: WorkflowService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- FLEET MANAGEMENT ---

  async createVehicle(
    tenantId: string,
    dto: CreateVehicleDto,
    _user: AuthUser,
  ): Promise<Vehicle> {
    const existing = await this.prisma.vehicle.findFirst({
      where: { tenantId, licensePlate: dto.licensePlate, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Vehicle with license plate ${dto.licensePlate} already exists.`,
      );
    }

    return this.prisma.vehicle.create({
      data: {
        tenantId,
        licensePlate: dto.licensePlate,
        model: dto.model,
        capacityWeight: new Prisma.Decimal(dto.capacityWeight),
        capacityVolume: new Prisma.Decimal(dto.capacityVolume),
        fuelEfficiency: new Prisma.Decimal(dto.fuelEfficiency),
        status: VehicleStatus.IDLE,
      },
    });
  }

  async updateVehicle(
    tenantId: string,
    id: string,
    expectedVersion: number,
    dto: UpdateVehicleDto,
    _user: AuthUser,
  ): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found.`);
    }
    if (vehicle.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const data: Prisma.VehicleUpdateInput = {
      version: { increment: 1 },
    };
    if (dto.model) data.model = dto.model;
    if (dto.capacityWeight !== undefined)
      data.capacityWeight = new Prisma.Decimal(dto.capacityWeight);
    if (dto.capacityVolume !== undefined)
      data.capacityVolume = new Prisma.Decimal(dto.capacityVolume);
    if (dto.fuelEfficiency !== undefined)
      data.fuelEfficiency = new Prisma.Decimal(dto.fuelEfficiency);
    if (dto.status) data.status = dto.status;

    return this.prisma.vehicle.update({
      where: { id },
      data,
    });
  }

  async deleteVehicle(
    tenantId: string,
    id: string,
    expectedVersion: number,
    _user: AuthUser,
  ): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found.`);
    }
    if (vehicle.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async getVehicles(tenantId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: { tenantId, deletedAt: null },
    });
  }

  // --- DRIVERS MANAGEMENT ---

  async createDriver(
    tenantId: string,
    dto: CreateDriverDto,
    _user: AuthUser,
  ): Promise<Driver> {
    const existing = await this.prisma.driver.findFirst({
      where: { tenantId, licenseNumber: dto.licenseNumber, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Driver with license number ${dto.licenseNumber} already exists.`,
      );
    }

    return this.prisma.driver.create({
      data: {
        tenantId,
        name: dto.name,
        licenseNumber: dto.licenseNumber,
        contactPhone: dto.contactPhone,
        status: DriverStatus.AVAILABLE,
      },
    });
  }

  async updateDriver(
    tenantId: string,
    id: string,
    expectedVersion: number,
    dto: UpdateDriverDto,
    _user: AuthUser,
  ): Promise<Driver> {
    const driver = await this.prisma.driver.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found.`);
    }
    if (driver.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const data: Prisma.DriverUpdateInput = {
      version: { increment: 1 },
    };
    if (dto.name) data.name = dto.name;
    if (dto.contactPhone) data.contactPhone = dto.contactPhone;
    if (dto.status) data.status = dto.status;

    return this.prisma.driver.update({
      where: { id },
      data,
    });
  }

  async deleteDriver(
    tenantId: string,
    id: string,
    expectedVersion: number,
    _user: AuthUser,
  ): Promise<Driver> {
    const driver = await this.prisma.driver.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found.`);
    }
    if (driver.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    return this.prisma.driver.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async getDrivers(tenantId: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: { tenantId, deletedAt: null },
    });
  }

  // --- CARRIERS MANAGEMENT ---

  async createCarrier(
    tenantId: string,
    dto: CreateCarrierDto,
    _user: AuthUser,
  ): Promise<Carrier> {
    const existing = await this.prisma.carrier.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Carrier with code ${dto.code} already exists.`,
      );
    }

    return this.prisma.carrier.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        slaRating: new Prisma.Decimal(dto.slaRating ?? 5.0),
        status: "ACTIVE",
      },
    });
  }

  async updateCarrier(
    tenantId: string,
    id: string,
    expectedVersion: number,
    dto: UpdateCarrierDto,
    _user: AuthUser,
  ): Promise<Carrier> {
    const carrier = await this.prisma.carrier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!carrier) {
      throw new NotFoundException(`Carrier ${id} not found.`);
    }
    if (carrier.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const data: Prisma.CarrierUpdateInput = {
      version: { increment: 1 },
    };
    if (dto.name) data.name = dto.name;
    if (dto.contactPerson) data.contactPerson = dto.contactPerson;
    if (dto.email) data.email = dto.email;
    if (dto.phone) data.phone = dto.phone;
    if (dto.slaRating !== undefined)
      data.slaRating = new Prisma.Decimal(dto.slaRating);
    if (dto.status) data.status = dto.status;

    return this.prisma.carrier.update({
      where: { id },
      data,
    });
  }

  async deleteCarrier(
    tenantId: string,
    id: string,
    expectedVersion: number,
    _user: AuthUser,
  ): Promise<Carrier> {
    const carrier = await this.prisma.carrier.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!carrier) {
      throw new NotFoundException(`Carrier ${id} not found.`);
    }
    if (carrier.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    return this.prisma.carrier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
  }

  async getCarriers(tenantId: string): Promise<Carrier[]> {
    return this.prisma.carrier.findMany({
      where: { tenantId, deletedAt: null },
    });
  }

  // --- SHIPMENT PLANNING ---

  async createShipment(
    tenantId: string,
    dto: CreateShipmentDto,
    user: AuthUser,
  ): Promise<Shipment> {
    const existing = await this.prisma.shipment.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Shipment with code ${dto.code} already exists.`,
      );
    }

    // 1. Verify Quality Release (prevent shipment of product under hold)
    if (dto.sourceType === ShipmentSourceType.SALES_ORDER && dto.salesOrderId) {
      const soItems = await this.prisma.salesOrderItem.findMany({
        where: { salesOrderId: dto.salesOrderId },
      });
      for (const item of soItems) {
        const holdLot = await this.prisma.inspectionLot.findFirst({
          where: {
            tenantId,
            productId: item.productId,
            status: {
              in: [InspectionLotStatus.PENDING, InspectionLotStatus.FAILED],
            },
          },
        });
        if (holdLot) {
          throw new BadRequestException(
            "Cannot create shipment: Product is currently under Quality Hold.",
          );
        }
      }
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // 2. Reserve WMS Stock
      if (
        dto.sourceType === ShipmentSourceType.SALES_ORDER &&
        dto.salesOrderId
      ) {
        const so = await tx.salesOrder.findUnique({
          where: { id: dto.salesOrderId },
          include: { items: true },
        });
        if (so) {
          for (const item of so.items) {
            // Check available stock in bins
            const binStocks = await tx.binStock.findMany({
              where: { tenantId, productId: item.productId },
              orderBy: { quantity: "desc" },
            });
            let needed = Number(item.quantity);
            for (const bs of binStocks) {
              if (needed <= 0) break;
              const qty = Number(bs.quantity);
              if (qty <= needed) {
                needed -= qty;
                await tx.binStock.delete({ where: { id: bs.id } });
              } else {
                await tx.binStock.update({
                  where: { id: bs.id },
                  data: { quantity: qty - needed },
                });
                needed = 0;
              }
            }
            if (needed > 0) {
              throw new BadRequestException(
                `Sufficient stock is not available in warehouse bins for product ${item.productId}.`,
              );
            }
          }
        }
      }

      const shipment = await tx.shipment.create({
        data: {
          tenantId,
          code: dto.code,
          status: ShipmentStatus.DRAFT,
          sourceType: dto.sourceType,
          salesOrderId: dto.salesOrderId,
          purchaseOrderId: dto.purchaseOrderId,
          totalWeight: new Prisma.Decimal(dto.totalWeight ?? 0),
          totalVolume: new Prisma.Decimal(dto.totalVolume ?? 0),
          freightCost: new Prisma.Decimal(dto.freightCost ?? 0),
          carrierId: dto.carrierId,
          stops: {
            create: dto.stops.map((s) => ({
              tenantId,
              sequence: s.sequence,
              stopType: s.stopType,
              address: s.address,
              estimatedTime: new Date(s.estimatedTime),
              status: StopStatus.PENDING,
            })),
          },
        },
        include: { stops: true },
      });

      await this.auditService.log(
        {
          action: "SHIPMENT_CREATED",
          entity: "Shipment",
          entityId: shipment.id,
          tenantId,
          userId: user.id,
          newValues: shipment,
        },
        tx,
      );

      return shipment;
    });
  }

  async getShipments(tenantId: string): Promise<Shipment[]> {
    return this.prisma.shipment.findMany({
      where: { tenantId, deletedAt: null },
      include: { stops: true, exceptions: true },
    });
  }

  // --- TRIP PLANNING & ROUTE OPTIMIZATION ---

  async createTrip(
    tenantId: string,
    dto: CreateTripDto,
    _user: AuthUser,
  ): Promise<Trip> {
    const existing = await this.prisma.trip.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Trip with code ${dto.code} already exists.`,
      );
    }

    // Vehicle capacity validation
    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
      });
      if (!vehicle || vehicle.status !== VehicleStatus.IDLE) {
        throw new BadRequestException("Vehicle is not available.");
      }

      const shipments = await this.prisma.shipment.findMany({
        where: { id: { in: dto.shipmentIds }, tenantId },
      });
      const totalWeight = shipments.reduce(
        (sum, s) => sum + Number(s.totalWeight),
        0,
      );
      const totalVolume = shipments.reduce(
        (sum, s) => sum + Number(s.totalVolume),
        0,
      );

      if (
        totalWeight > Number(vehicle.capacityWeight) ||
        totalVolume > Number(vehicle.capacityVolume)
      ) {
        throw new BadRequestException(
          "Total shipment weight/volume exceeds vehicle capacity.",
        );
      }
    }

    if (dto.driverId) {
      const driver = await this.prisma.driver.findUnique({
        where: { id: dto.driverId },
      });
      if (!driver || driver.status !== DriverStatus.AVAILABLE) {
        throw new BadRequestException("Driver is not available.");
      }
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const trip = await tx.trip.create({
        data: {
          tenantId,
          code: dto.code,
          vehicleId: dto.vehicleId,
          driverId: dto.driverId,
          carrierId: dto.carrierId,
          status: TripStatus.PLANNED,
          estimatedDistance: new Prisma.Decimal(dto.estimatedDistance),
          estimatedDuration: dto.estimatedDuration,
          routePath: dto.routePath,
          shipments: {
            connect: dto.shipmentIds.map((id) => ({ id })),
          },
        },
      });

      // Update shipment statuses
      await tx.shipment.updateMany({
        where: { id: { in: dto.shipmentIds } },
        data: { status: ShipmentStatus.PLANNED, tripId: trip.id },
      });

      return trip;
    });
  }

  async dispatchTrip(
    tenantId: string,
    id: string,
    expectedVersion: number,
    dto: DispatchTripDto,
    user: AuthUser,
  ): Promise<Trip> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { shipments: true },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found.`);
    }
    if (trip.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const totalFreightCost = trip.shipments.reduce(
      (sum, s) => sum + Number(s.freightCost),
      0,
    );

    // 1. Workflow Approval Trigger (> 1000 threshold)
    if (totalFreightCost > 1000 && trip.status === TripStatus.PLANNED) {
      return this.transactionHelper.run(async (tx: PrismaTx) => {
        const updated = await tx.trip.update({
          where: { id },
          data: {
            status: TripStatus.PENDING_APPROVAL,
            version: { increment: 1 },
          },
        });

        // Trigger Workflow engine
        await this.workflowService.submitInstance(
          {
            definitionCode: "TMS_FREIGHT_APPROVAL",
            entityType: "Trip",
            entityId: id,
          },
          user,
        );

        await this.notificationsService.createInternal(
          {
            tenantId,
            userId: user.id,
            title: "Trip Pending Approval",
            message: `Trip ${trip.code} requires dispatcher approval because freight cost exceeds $1,000.`,
            type: NotificationType.WARNING,
          },
          tx,
        );

        return updated;
      });
    }

    // 2. Direct Dispatch
    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.trip.update({
        where: { id },
        data: {
          status: TripStatus.DISPATCHED,
          startedAt: new Date(),
          startOdometer: dto.startOdometer
            ? new Prisma.Decimal(dto.startOdometer)
            : null,
          version: { increment: 1 },
        },
      });

      // Update vehicle & driver status
      if (trip.vehicleId) {
        await tx.vehicle.update({
          where: { id: trip.vehicleId },
          data: { status: VehicleStatus.IN_TRANSIT },
        });
      }
      if (trip.driverId) {
        await tx.driver.update({
          where: { id: trip.driverId },
          data: { status: DriverStatus.ON_TRIP },
        });
      }

      // Update shipments
      await tx.shipment.updateMany({
        where: { tripId: id },
        data: { status: ShipmentStatus.DISPATCHED },
      });

      await this.auditService.log(
        {
          action: "TRIP_STARTED",
          entity: "Trip",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: updated,
        },
        tx,
      );

      // Book Accrual Entries
      if (totalFreightCost > 0) {
        await this.postAccrualEntry(
          tx,
          tenantId,
          id,
          totalFreightCost,
          trip.code,
          user,
        );
      }

      return updated;
    });
  }

  // --- WORKFLOW CALLBACK ---
  async onWorkflowComplete(
    tx: PrismaTx,
    tenantId: string,
    entityId: string,
    status: WorkflowInstanceStatus,
    user: AuthUser,
  ) {
    const trip = await tx.trip.findFirst({
      where: { id: entityId, tenantId, deletedAt: null },
    });
    if (!trip) return;

    if (status === WorkflowInstanceStatus.APPROVED) {
      // Complete Dispatch
      await tx.trip.update({
        where: { id: entityId },
        data: {
          status: TripStatus.DISPATCHED,
          startedAt: new Date(),
        },
      });

      if (trip.vehicleId) {
        await tx.vehicle.update({
          where: { id: trip.vehicleId },
          data: { status: VehicleStatus.IN_TRANSIT },
        });
      }
      if (trip.driverId) {
        await tx.driver.update({
          where: { id: trip.driverId },
          data: { status: DriverStatus.ON_TRIP },
        });
      }

      await tx.shipment.updateMany({
        where: { tripId: entityId },
        data: { status: ShipmentStatus.DISPATCHED },
      });

      const shipments = await tx.shipment.findMany({
        where: { tripId: entityId },
      });
      const totalCost = shipments.reduce(
        (sum, s) => sum + Number(s.freightCost),
        0,
      );
      if (totalCost > 0) {
        await this.postAccrualEntry(
          tx,
          tenantId,
          entityId,
          totalCost,
          trip.code,
          user,
        );
      }
    } else {
      await tx.trip.update({
        where: { id: entityId },
        data: { status: TripStatus.CANCELLED },
      });
    }
  }

  private async postAccrualEntry(
    tx: PrismaTx,
    tenantId: string,
    tripId: string,
    amount: number,
    tripCode: string,
    user: AuthUser,
  ) {
    const freightAccount = await this.getOrCreateAccount(
      tx,
      tenantId,
      "5300",
      "Freight Expense",
      AccountType.EXPENSE,
    );
    const accrualAccount = await this.getOrCreateAccount(
      tx,
      tenantId,
      "2200",
      "Freight Accruals",
      AccountType.LIABILITY,
    );

    const entryCode = `FREIGHT-ACC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        entryNumber: entryCode,
        postingDate: new Date(),
        description: `Accrued freight cost for trip ${tripCode}`,
        sourceType: JournalSourceType.MANUAL,
        sourceId: tripId,
        status: "DRAFT",
        lines: {
          create: [
            {
              tenantId,
              accountId: freightAccount.id,
              debit: amount,
              credit: 0,
              description: "Accrued transport carriage expense",
            },
            {
              tenantId,
              accountId: accrualAccount.id,
              debit: 0,
              credit: amount,
              description: "Accrued carriage liability",
            },
          ],
        },
      },
    });

    await this.accountingService.postJournalEntry(
      entry.id,
      { expectedVersion: 1 },
      user,
      tx,
    );
  }

  async completeTrip(
    tenantId: string,
    id: string,
    expectedVersion: number,
    dto: CompleteTripDto,
    user: AuthUser,
  ): Promise<Trip> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found.`);
    }
    if (trip.version !== expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.trip.update({
        where: { id },
        data: {
          status: TripStatus.COMPLETED,
          completedAt: new Date(),
          endOdometer: dto.endOdometer
            ? new Prisma.Decimal(dto.endOdometer)
            : null,
          version: { increment: 1 },
        },
      });

      // Update vehicle & driver status
      if (trip.vehicleId) {
        await tx.vehicle.update({
          where: { id: trip.vehicleId },
          data: { status: VehicleStatus.IDLE },
        });
      }
      if (trip.driverId) {
        await tx.driver.update({
          where: { id: trip.driverId },
          data: { status: DriverStatus.AVAILABLE },
        });
      }

      await this.auditService.log(
        {
          action: "TRIP_COMPLETED",
          entity: "Trip",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: updated,
        },
        tx,
      );

      return updated;
    });
  }

  async getTrips(tenantId: string): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      where: { tenantId, deletedAt: null },
      include: { shipments: true, gpsLogs: true },
    });
  }

  // --- POD & DELIVERY STATUS ---

  async recordPOD(
    tenantId: string,
    shipmentId: string,
    stopId: string,
    dto: RecordPODDto,
    user: AuthUser,
  ): Promise<Shipment> {
    return this.transactionHelper.run(async (tx: PrismaTx) => {
      await tx.shipmentStop.update({
        where: { id: stopId },
        data: {
          status: StopStatus.ARRIVED,
          actualTime: new Date(),
          signature: dto.signature,
          signedByName: dto.signedByName,
          notes: dto.notes,
        },
      });

      // Update shipment status to COMPLETED if all stops are done
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { stops: true },
      });
      if (!shipment)
        throw new NotFoundException(`Shipment ${shipmentId} not found.`);

      const allDone = shipment.stops.every(
        (s) => s.id === stopId || s.status === StopStatus.ARRIVED,
      );
      if (allDone) {
        const updatedShipment = await tx.shipment.update({
          where: { id: shipmentId },
          data: { status: ShipmentStatus.COMPLETED, version: { increment: 1 } },
          include: { stops: true },
        });

        await this.auditService.log(
          {
            action: "SHIPMENT_DELIVERED",
            entity: "Shipment",
            entityId: shipmentId,
            tenantId,
            userId: user.id,
            newValues: updatedShipment,
          },
          tx,
        );

        // Quality Integration: Handle Customer Return inspections
        if (
          shipment.sourceType === ShipmentSourceType.CUSTOMER_RETURN &&
          shipment.salesOrderId
        ) {
          const so = await tx.salesOrder.findFirst({
            where: { id: shipment.salesOrderId },
            include: { items: true },
          });
          const warehouse = await tx.warehouse.findFirst({
            where: { tenantId, deletedAt: null },
          });
          if (so && warehouse) {
            for (const item of so.items) {
              await tx.inspectionLot.create({
                data: {
                  tenantId,
                  code: `RET-INS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
                  productId: item.productId,
                  quantity: item.quantity,
                  sampleSize: 1,
                  warehouseId: warehouse.id,
                  type: InspectionLotType.CUSTOMER_RETURN,
                  status: InspectionLotStatus.PENDING,
                },
              });
            }
          }
        }

        return updatedShipment;
      }

      return shipment;
    });
  }

  // --- EXCEPTIONS & Reverse LOGISTICS ---

  async logException(
    tenantId: string,
    shipmentId: string,
    dto: LogExceptionDto,
    user: AuthUser,
  ): Promise<Shipment> {
    return this.transactionHelper.run(async (tx: PrismaTx) => {
      await tx.shipmentException.create({
        data: {
          tenantId,
          shipmentId,
          stopId: dto.stopId,
          type: dto.type,
          description: dto.description,
        },
      });

      // Transition shipment status to reflect delay/exception
      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.IN_TRANSIT, version: { increment: 1 } },
        include: { exceptions: true, stops: true },
      });

      await this.notificationsService.createInternal(
        {
          tenantId,
          userId: user.id,
          title: "Shipment Exception Logged",
          message: `Exception logged for shipment ${updated.code}: ${dto.description}`,
          type: NotificationType.ERROR,
        },
        tx,
      );

      return updated;
    });
  }

  // --- FUEL & MAINTENANCE ---

  async logFuel(
    tenantId: string,
    vehicleId: string,
    dto: LogFuelDto,
    user: AuthUser,
  ) {
    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const fuel = await tx.fuelLog.create({
        data: {
          tenantId,
          vehicleId,
          logDate: new Date(dto.logDate),
          fuelAmount: new Prisma.Decimal(dto.fuelAmount),
          costPerLiter: new Prisma.Decimal(dto.costPerLiter),
          totalCost: new Prisma.Decimal(dto.totalCost),
          odometer: new Prisma.Decimal(dto.odometer),
        },
      });

      // Post Fuel Journal Entry (Debit Fuel Expense 5310, Credit Cash 1010)
      const fuelExpenseAccount = await this.getOrCreateAccount(
        tx,
        tenantId,
        "5310",
        "Fuel Expense",
        AccountType.EXPENSE,
      );
      const cashAccount = await this.getOrCreateAccount(
        tx,
        tenantId,
        "1010",
        "Cash/Bank",
        AccountType.ASSET,
      );

      const entryCode = `FUEL-EXP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber: entryCode,
          postingDate: new Date(),
          description: `Fuel refueling log for vehicle ${vehicleId}`,
          sourceType: JournalSourceType.MANUAL,
          sourceId: fuel.id,
          status: "DRAFT",
          lines: {
            create: [
              {
                tenantId,
                accountId: fuelExpenseAccount.id,
                debit: dto.totalCost,
                credit: 0,
                description: "Fuel expense booking",
              },
              {
                tenantId,
                accountId: cashAccount.id,
                debit: 0,
                credit: dto.totalCost,
                description: "Cash payment for fuel",
              },
            ],
          },
        },
      });

      await this.accountingService.postJournalEntry(
        entry.id,
        { expectedVersion: 1 },
        user,
        tx,
      );

      return fuel;
    });
  }

  async scheduleMaintenance(
    tenantId: string,
    vehicleId: string,
    dto: ScheduleMaintenanceDto,
    _user: AuthUser,
  ) {
    return this.prisma.maintenanceSchedule.create({
      data: {
        tenantId,
        vehicleId,
        type: dto.type,
        description: dto.description,
        scheduledDate: new Date(dto.scheduledDate),
        status: MaintenanceStatus.SCHEDULED,
      },
    });
  }

  // --- GPS LOCATION LOGGER ---

  async logGPS(
    tenantId: string,
    tripId: string,
    dto: LogGPSDto,
    _user: AuthUser,
  ) {
    return this.prisma.gPSLog.create({
      data: {
        tenantId,
        tripId,
        latitude: new Prisma.Decimal(dto.latitude),
        longitude: new Prisma.Decimal(dto.longitude),
      },
    });
  }

  // --- GL ACCOUNT RESOLVER ---

  private async getOrCreateAccount(
    tx: PrismaTx,
    tenantId: string,
    code: string,
    name: string,
    type: AccountType,
  ) {
    let account = await tx.account.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!account) {
      account = await tx.account.create({
        data: {
          tenantId,
          code,
          name,
          type,
          status: "ACTIVE",
        },
      });
    }
    return account;
  }
}
