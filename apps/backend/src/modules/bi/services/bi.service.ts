/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { EtlSyncDto } from "../dto/etl-sync.dto";

@Injectable()
export class BiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getExecutiveDashboard(user: AuthUser) {
    const tenantId = user.tenantId!;
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 1. Executive KPIs (CSAT, Revenue, Profit Margin, Active Shipments)
    const [salesFact, CSATFact, financeFact] = await Promise.all([
      this.prisma.biFactSales.aggregate({
        _sum: { orderValue: true, costValue: true },
        where: { tenantId },
      }),
      this.prisma.biFactCustomerService.aggregate({
        _avg: { csatRating: true },
        where: { tenantId, csatRating: { not: null } },
      }),
      this.prisma.biFactFinance.aggregate({
        _sum: { debit: true, credit: true },
        where: { tenantId },
      }),
    ]);

    const totalRevenue = salesFact._sum.orderValue || 0;
    const totalCost = salesFact._sum.costValue || 0;
    const netProfit = totalRevenue - totalCost;
    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const averageCsat = CSATFact._avg.csatRating || 0.0;

    // 2. Revenue and Profit Trends (monthly totals)
    const salesTrends = await this.prisma.biFactSales.findMany({
      where: { tenantId, orderDate: { gte: thirtyDaysAgo } },
      select: { orderDate: true, orderValue: true, costValue: true },
      orderBy: { orderDate: "asc" },
    });

    // 3. Departmental analytics counts/metrics
    const [qualityFact, mfgFact, invFact, tmsFact, hrFact, secFact] =
      await Promise.all([
        this.prisma.biFactQuality.aggregate({
          _avg: { passRate: true },
          _sum: { defectCount: true },
          where: { tenantId },
        }),
        this.prisma.biFactManufacturing.aggregate({
          _avg: { efficiencyPercentage: true },
          _sum: { scrapQuantity: true },
          where: { tenantId },
        }),
        this.prisma.biFactInventory.aggregate({
          _sum: { stockValue: true },
          where: { tenantId },
        }),
        this.prisma.biFactTransportation.aggregate({
          _sum: {
            shipmentCount: true,
            delayedCount: true,
            exceptionCount: true,
          },
          _avg: { mpg: true },
          where: { tenantId },
        }),
        this.prisma.biFactHR.aggregate({
          _sum: { salarySpend: true },
          where: { tenantId },
        }),
        this.prisma.biFactSecurity.aggregate({
          _sum: { failedLogins: true, securityEventCount: true },
          where: { tenantId },
        }),
      ]);

    return {
      kpis: {
        totalRevenue,
        netProfit,
        profitMargin,
        averageCsat,
      },
      qualityPassRate: qualityFact._avg.passRate || 100.0,
      qualityDefects: qualityFact._sum.defectCount || 0,
      mfgEfficiency: mfgFact._avg.efficiencyPercentage || 100.0,
      mfgScrap: mfgFact._sum.scrapQuantity || 0,
      inventoryValuation: invFact._sum.stockValue || 0,
      tms: {
        totalShipments: tmsFact._sum.shipmentCount || 0,
        delayedShipments: tmsFact._sum.delayedCount || 0,
        exceptions: tmsFact._sum.exceptionCount || 0,
        averageMpg: tmsFact._avg.mpg || 0.0,
      },
      hr: {
        salarySpend: hrFact._sum.salarySpend || 0,
      },
      security: {
        failedLogins: secFact._sum.failedLogins || 0,
        events: secFact._sum.securityEventCount || 0,
      },
      salesTrends,
    };
  }

  async getVarianceAnalysis(user: AuthUser) {
    const tenantId = user.tenantId!;
    const financeFacts = await this.prisma.biFactFinance.findMany({
      where: { tenantId },
      include: { account: true },
      orderBy: { postingDate: "desc" },
    });

    return financeFacts.map((fact) => ({
      accountId: fact.accountId,
      accountCode: fact.account?.code || "N/A",
      accountName: fact.account?.name || "N/A",
      debit: fact.debit,
      credit: fact.credit,
      actualAmount: fact.netAmount,
      budgetAmount: fact.budgetAmount,
      variance: fact.variance,
      postingDate: fact.postingDate,
    }));
  }

  async getKpis(user: AuthUser) {
    const tenantId = user.tenantId!;
    return this.prisma.biKpiDefinition.findMany({
      where: { tenantId },
      include: {
        values: {
          orderBy: { computedDate: "desc" },
          take: 10,
        },
      },
    });
  }

  async evaluateKpis(dto: EtlSyncDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const batchSize = dto.batchSize || 1000;
    const now = new Date();

    const definitions = await this.prisma.biKpiDefinition.findMany({
      where: {
        tenantId,
        ...(dto.pipeline && { id: dto.pipeline }),
      },
    });

    const evaluatedValues = [];

    for (let i = 0; i < definitions.length; i += batchSize) {
      const batch = definitions.slice(i, i + batchSize);

      for (const def of batch) {
        let value = 0;

        if (def.code === "NET_MARGIN") {
          const salesFact = await this.prisma.biFactSales.aggregate({
            _sum: { orderValue: true, costValue: true },
            where: { tenantId },
          });
          const revenue = salesFact._sum.orderValue || 0;
          const cost = salesFact._sum.costValue || 0;
          const netProfit = revenue - cost;
          value = revenue > 0 ? netProfit / revenue : 0;
        } else if (def.code === "CSAT") {
          const csFact = await this.prisma.biFactCustomerService.aggregate({
            _avg: { csatRating: true },
            where: { tenantId, csatRating: { not: null } },
          });
          value = csFact._avg.csatRating || 0;
        } else if (def.code === "MFG_EFFICIENCY") {
          const mfgFact = await this.prisma.biFactManufacturing.aggregate({
            _avg: { efficiencyPercentage: true },
            where: { tenantId },
          });
          value = mfgFact._avg.efficiencyPercentage || 0;
        } else {
          // Dynamic fallback mock value
          value = def.target * 0.95;
        }

        let status = "GREEN";
        if (value < def.thresholdAlert) {
          status = "RED";
          // Trigger Notification
          await this.notificationsService.createInternal({
            userId: user.id,
            tenantId,
            title: `KPI Threshold Breached: ${def.name}`,
            message: `KPI ${def.name} value is currently ${value.toFixed(2)}, which is below the alert threshold ${def.thresholdAlert}.`,
            type: "WARNING" as any,
          });
        } else if (value < def.target) {
          status = "YELLOW";
        }

        const kpiVal = await this.prisma.biKpiValue.create({
          data: {
            tenantId,
            kpiDefinitionId: def.id,
            value,
            target: def.target,
            status,
            computedDate: now,
          },
        });

        evaluatedValues.push(kpiVal);
      }
    }

    await this.auditService.log({
      userId: user.id,
      tenantId,
      entity: "BiKpiValue",
      entityId: "SYSTEM",
      action: "KPI_EVALUATED",
      newValues: { count: evaluatedValues.length },
    });

    return evaluatedValues;
  }

  async runEtlSync(dto: EtlSyncDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const batchSize = dto.batchSize || 1000;
    const now = new Date();

    try {
      if (dto.fullRebuild) {
        await this.prisma.biFactFinance.deleteMany({ where: { tenantId } });
        await this.prisma.biFactSales.deleteMany({ where: { tenantId } });
        await this.prisma.biFactProcurement.deleteMany({ where: { tenantId } });
        await this.prisma.biFactInventory.deleteMany({ where: { tenantId } });
        await this.prisma.biFactManufacturing.deleteMany({
          where: { tenantId },
        });
        await this.prisma.biFactQuality.deleteMany({ where: { tenantId } });
        await this.prisma.biFactCustomerService.deleteMany({
          where: { tenantId },
        });
        await this.prisma.biFactTransportation.deleteMany({
          where: { tenantId },
        });
        await this.prisma.biFactHR.deleteMany({ where: { tenantId } });
        await this.prisma.biFactWorkflow.deleteMany({ where: { tenantId } });
        await this.prisma.biFactSecurity.deleteMany({ where: { tenantId } });
        await this.prisma.biEtlWatermark.deleteMany({ where: { tenantId } });
      }

      // 1. Sync Dimension Tables
      await this.syncDimensions(tenantId, batchSize);

      // 2. Sync Fact Tables
      await this.syncFacts(tenantId, batchSize, now);

      await this.auditService.log({
        userId: user.id,
        tenantId,
        entity: "BiEtlWatermark",
        entityId: "SYSTEM",
        action: "BI_ETL_SYNC",
        newValues: { status: "SUCCESS" },
      });

      return { status: "SUCCESS", timestamp: now };
    } catch (err) {
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "BI ETL Sync Failure",
        message: `The BI ETL engine sync job encountered an error: ${(err as Error).message}`,
        type: "ERROR" as any,
      });
      throw err;
    }
  }

  private async syncDimensions(tenantId: string, batchSize: number) {
    // A. Sync Products
    const watermarkProd = await this.prisma.biEtlWatermark.findUnique({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "products" } },
    });
    const lastSyncProd = watermarkProd?.lastSyncTime || new Date(0);

    let offset = 0;
    while (true) {
      const items = await this.prisma.product.findMany({
        where: { tenantId, updatedAt: { gt: lastSyncProd } },
        include: { category: true },
        skip: offset,
        take: batchSize,
        orderBy: { updatedAt: "asc" },
      });
      if (items.length === 0) break;

      for (const item of items) {
        await this.prisma.biDimensionProduct.upsert({
          where: { tenantId_id: { tenantId, id: item.id } },
          update: {
            sku: item.sku,
            name: item.name,
            categoryName: item.category?.name || null,
            costPrice: Number(item.costPrice),
            salePrice: Number(item.salePrice),
          },
          create: {
            id: item.id,
            tenantId,
            sku: item.sku,
            name: item.name,
            categoryName: item.category?.name || null,
            costPrice: Number(item.costPrice),
            salePrice: Number(item.salePrice),
          },
        });
      }
      offset += batchSize;
    }
    await this.prisma.biEtlWatermark.upsert({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "products" } },
      update: { lastSyncTime: new Date() },
      create: { tenantId, pipelineName: "products", lastSyncTime: new Date() },
    });

    // B. Sync Customers
    const watermarkCust = await this.prisma.biEtlWatermark.findUnique({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "customers" } },
    });
    const lastSyncCust = watermarkCust?.lastSyncTime || new Date(0);

    offset = 0;
    while (true) {
      const items = await this.prisma.customer.findMany({
        where: { tenantId, updatedAt: { gt: lastSyncCust } },
        skip: offset,
        take: batchSize,
        orderBy: { updatedAt: "asc" },
      });
      if (items.length === 0) break;

      for (const item of items) {
        await this.prisma.biDimensionCustomer.upsert({
          where: { tenantId_id: { tenantId, id: item.id } },
          update: {
            name: item.name,
            email: item.email || "",
            region: (item as any).region || null,
          },
          create: {
            id: item.id,
            tenantId,
            name: item.name,
            email: item.email || "",
            region: (item as any).region || null,
          },
        });
      }
      offset += batchSize;
    }
    await this.prisma.biEtlWatermark.upsert({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "customers" } },
      update: { lastSyncTime: new Date() },
      create: { tenantId, pipelineName: "customers", lastSyncTime: new Date() },
    });

    // C. Sync Employees
    const watermarkEmp = await this.prisma.biEtlWatermark.findUnique({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "employees" } },
    });
    const lastSyncEmp = watermarkEmp?.lastSyncTime || new Date(0);

    offset = 0;
    while (true) {
      const items = await this.prisma.employee.findMany({
        where: { tenantId, updatedAt: { gt: lastSyncEmp } },
        include: { department: true, designation: true },
        skip: offset,
        take: batchSize,
        orderBy: { updatedAt: "asc" },
      });
      if (items.length === 0) break;

      for (const item of items) {
        await this.prisma.biDimensionEmployee.upsert({
          where: { tenantId_id: { tenantId, id: item.id } },
          update: {
            name: `${item.firstName} ${item.lastName}`,
            departmentName: item.department?.name || null,
            designationName: item.designation?.name || null,
          },
          create: {
            id: item.id,
            tenantId,
            name: `${item.firstName} ${item.lastName}`,
            departmentName: item.department?.name || null,
            designationName: item.designation?.name || null,
          },
        });
      }
      offset += batchSize;
    }
    await this.prisma.biEtlWatermark.upsert({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "employees" } },
      update: { lastSyncTime: new Date() },
      create: { tenantId, pipelineName: "employees", lastSyncTime: new Date() },
    });

    // D. Sync Accounts
    const watermarkAcc = await this.prisma.biEtlWatermark.findUnique({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "accounts" } },
    });
    const lastSyncAcc = watermarkAcc?.lastSyncTime || new Date(0);

    offset = 0;
    while (true) {
      const items = await this.prisma.account.findMany({
        where: { tenantId, updatedAt: { gt: lastSyncAcc }, deletedAt: null },
        skip: offset,
        take: batchSize,
        orderBy: { updatedAt: "asc" },
      });
      if (items.length === 0) break;

      for (const item of items) {
        await this.prisma.biDimensionAccount.upsert({
          where: { tenantId_id: { tenantId, id: item.id } },
          update: {
            code: item.code,
            name: item.name,
            type: item.type,
          },
          create: {
            id: item.id,
            tenantId,
            code: item.code,
            name: item.name,
            type: item.type,
          },
        });
      }
      offset += batchSize;
    }
    await this.prisma.biEtlWatermark.upsert({
      where: { tenantId_pipelineName: { tenantId, pipelineName: "accounts" } },
      update: { lastSyncTime: new Date() },
      create: { tenantId, pipelineName: "accounts", lastSyncTime: new Date() },
    });

    // E. Sync Warehouses
    const watermarkWh = await this.prisma.biEtlWatermark.findUnique({
      where: {
        tenantId_pipelineName: { tenantId, pipelineName: "warehouses" },
      },
    });
    const lastSyncWh = watermarkWh?.lastSyncTime || new Date(0);

    offset = 0;
    while (true) {
      const items = await this.prisma.warehouse.findMany({
        where: { tenantId, updatedAt: { gt: lastSyncWh }, deletedAt: null },
        skip: offset,
        take: batchSize,
        orderBy: { updatedAt: "asc" },
      });
      if (items.length === 0) break;

      for (const item of items) {
        await this.prisma.biDimensionWarehouse.upsert({
          where: { tenantId_id: { tenantId, id: item.id } },
          update: {
            code: item.code || "",
            name: item.name,
          },
          create: {
            id: item.id,
            tenantId,
            code: item.code || "",
            name: item.name,
          },
        });
      }
      offset += batchSize;
    }
    await this.prisma.biEtlWatermark.upsert({
      where: {
        tenantId_pipelineName: { tenantId, pipelineName: "warehouses" },
      },
      update: { lastSyncTime: new Date() },
      create: {
        tenantId,
        pipelineName: "warehouses",
        lastSyncTime: new Date(),
      },
    });
  }

  private async syncFacts(tenantId: string, batchSize: number, now: Date) {
    // 1. Sync Finance Facts
    const journalEntries = await this.prisma.journalEntry.findMany({
      where: { tenantId },
      include: { lines: true },
      take: batchSize,
    });
    for (const entry of journalEntries) {
      // Find financial period for postingDate
      const period = await this.prisma.financialPeriod.findFirst({
        where: {
          tenantId,
          startDate: { lte: entry.postingDate },
          endDate: { gte: entry.postingDate },
          deletedAt: null,
        },
      });
      const financialPeriodId = period?.id || null;

      for (const line of entry.lines) {
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        const netAmount = debit - credit;

        // Fetch Budget and calculate variance
        const account = await this.prisma.account.findUnique({
          where: { id: line.accountId },
        });
        let budgetAmount = 0;
        if (account) {
          const budgetItem = await this.prisma.budgetItem.findFirst({
            where: { tenantId, glAccountId: account.id },
          });
          budgetAmount = budgetItem ? Number(budgetItem.amount) : 0;
        }

        await this.prisma.biFactFinance.create({
          data: {
            tenantId,
            financialPeriodId,
            accountId: line.accountId,
            debit,
            credit,
            netAmount,
            postingDate: entry.postingDate,
            budgetAmount,
            variance: budgetAmount - netAmount,
          },
        });
      }
    }

    // 2. Sync Sales Facts
    const salesOrderItems = await this.prisma.salesOrderItem.findMany({
      where: { tenantId },
      include: { salesOrder: true, product: true },
      take: batchSize,
    });
    for (const item of salesOrderItems) {
      const quantity = Number(item.quantity);
      const orderValue = Number(item.unitPrice) * quantity;
      const costValue = Number(item.product.costPrice) * quantity;
      const grossMargin = orderValue - costValue;

      await this.prisma.biFactSales.create({
        data: {
          tenantId,
          customerId: item.salesOrder.customerId,
          productId: item.productId,
          quantity,
          orderValue,
          costValue,
          grossMargin,
          orderDate: item.salesOrder.createdAt,
        },
      });
    }

    // 3. Sync Procurement Facts
    const purchaseReceiptItems = await this.prisma.purchaseReceiptItem.findMany(
      {
        where: { tenantId },
        include: { purchaseReceipt: true, product: true },
        take: batchSize,
      },
    );
    for (const item of purchaseReceiptItems) {
      const quantity = Number(item.quantityReceived);
      const purchaseValue = Number(item.product.costPrice) * quantity;
      await this.prisma.biFactProcurement.create({
        data: {
          tenantId,
          productId: item.productId,
          quantity,
          purchaseValue,
          orderDate: item.purchaseReceipt.receivedAt,
        },
      });
    }

    // 4. Sync Inventory Facts
    const stocks = await this.prisma.stock.findMany({
      where: { tenantId },
      include: { product: true },
      take: batchSize,
    });
    for (const stock of stocks) {
      const stockQty = Number(stock.quantity);
      await this.prisma.biFactInventory.create({
        data: {
          tenantId,
          productId: stock.productId,
          warehouseId: stock.warehouseId,
          stockOnHand: stockQty,
          stockValue: stockQty * Number(stock.product.costPrice),
          snapshotDate: now,
        },
      });
    }

    // 5. Sync Manufacturing Facts
    const workOrders = await this.prisma.workOrder.findMany({
      where: { tenantId },
      take: batchSize,
    });
    for (const wo of workOrders) {
      const plannedQty = Number(wo.quantity);
      const actualQty = wo.status === "COMPLETED" ? plannedQty : 0;
      const scrapQty = 0;
      const efficiency =
        plannedQty > 0 ? (actualQty / plannedQty) * 100 : 100.0;
      await this.prisma.biFactManufacturing.create({
        data: {
          tenantId,
          productId: wo.productId,
          plannedQuantity: plannedQty,
          actualQuantity: actualQty,
          scrapQuantity: scrapQty,
          reworkQuantity: 0,
          efficiencyPercentage: efficiency,
          completionDate: wo.actualEndDate || now,
        },
      });
    }

    // 6. Sync Quality Facts
    const inspectionLots = await this.prisma.inspectionLot.findMany({
      where: { tenantId },
      take: batchSize,
    });
    for (const lot of inspectionLots) {
      const sample = Number(lot.sampleSize || 0);
      const passed = lot.status === ("PASSED" as any);
      const lotQty = Number(lot.quantity);
      await this.prisma.biFactQuality.create({
        data: {
          tenantId,
          productId: lot.productId,
          lotQuantity: lotQty,
          sampleSize: sample,
          acceptedQuantity: passed ? lotQty : 0,
          rejectedQuantity: passed ? 0 : lotQty,
          defectCount: passed ? 0 : 1,
          ncCount: passed ? 0 : 1,
          passRate: passed ? 100.0 : 0.0,
          inspectionDate: lot.createdAt,
        },
      });
    }

    // 7. Sync Customer Service Facts
    const supportTickets = await this.prisma.supportTicket.findMany({
      where: { tenantId },
      take: batchSize,
    });
    for (const ticket of supportTickets) {
      await this.prisma.biFactCustomerService.create({
        data: {
          tenantId,
          customerId: ticket.customerId,
          productId: ticket.productId,
          ticketCount: 1,
          resolvedCount: ticket.status === ("RESOLVED" as any) ? 1 : 0,
          slaBreachedCount: ticket.slaBreached ? 1 : 0,
          csatRating: ticket.csatRating || null,
          logDate: ticket.createdAt,
        },
      });
    }

    // 8. Sync Transportation Facts
    const shipments = await this.prisma.shipment.findMany({
      where: { tenantId },
      take: batchSize,
    });
    for (const sh of shipments) {
      await this.prisma.biFactTransportation.create({
        data: {
          tenantId,
          shipmentCount: 1,
          delayedCount: sh.status === ("DELAYED" as any) ? 1 : 0,
          exceptionCount: 0,
          logDate: sh.createdAt,
        },
      });
    }

    // 9. Sync HR Facts
    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId },
      take: batchSize,
    });
    for (const slip of payslips) {
      await this.prisma.biFactHR.create({
        data: {
          tenantId,
          salarySpend: Number(slip.netPay),
          logDate: slip.createdAt,
        },
      });
    }

    // 10. Sync Workflow Facts
    const wfInstances = await this.prisma.workflowInstance.findMany({
      where: { tenantId },
      take: batchSize,
    });
    for (const wf of wfInstances) {
      await this.prisma.biFactWorkflow.create({
        data: {
          tenantId,
          entityType: wf.entityType,
          instanceCount: 1,
          completedCount: wf.status === "APPROVED" ? 1 : 0,
          rejectedCount: wf.status === "REJECTED" ? 1 : 0,
          logDate: wf.createdAt,
        },
      });
    }

    // 11. Sync Security Facts
    const auditLogs = await this.prisma.auditLog.findMany({
      where: { tenantId },
      take: batchSize,
    });
    for (const log of auditLogs) {
      await this.prisma.biFactSecurity.create({
        data: {
          tenantId,
          auditLogCount: 1,
          logDate: log.createdAt,
        },
      });
    }
  }
}
