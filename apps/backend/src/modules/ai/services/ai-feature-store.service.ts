/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class AiFeatureStoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async syncFeatures(tenantId: string, user: AuthUser) {
    // 1. Sync Product features
    const products = await this.prisma.biDimensionProduct.findMany({
      where: { tenantId },
    });
    for (const prod of products) {
      // aggregate quality pass rates & WMS stock levels
      const qualityAgg = await this.prisma.biFactQuality.aggregate({
        _avg: { passRate: true, defectCount: true },
        where: { tenantId, productId: prod.id },
      });
      const invAgg = await this.prisma.biFactInventory.aggregate({
        _avg: { stockOnHand: true, stockValue: true },
        where: { tenantId, productId: prod.id },
      });

      const features = {
        avgPassRate: Number(qualityAgg._avg.passRate || 1.0),
        avgDefectCount: Number(qualityAgg._avg.defectCount || 0.0),
        avgStockOnHand: Number(invAgg._avg.stockOnHand || 0.0),
        avgStockValue: Number(invAgg._avg.stockValue || 0.0),
      };

      await this.prisma.aiFeatureStore.upsert({
        where: {
          tenantId_entityType_entityId_featureGroup: {
            tenantId,
            entityType: "PRODUCT",
            entityId: prod.id,
            featureGroup: "product_performance",
          },
        },
        update: {
          features,
          version: { increment: 1 },
        },
        create: {
          tenantId,
          entityType: "PRODUCT",
          entityId: prod.id,
          featureGroup: "product_performance",
          features,
        },
      });
    }

    // 2. Sync Customer features
    const customers = await this.prisma.biDimensionCustomer.findMany({
      where: { tenantId },
    });
    for (const cust of customers) {
      const salesAgg = await this.prisma.biFactSales.aggregate({
        _sum: { orderValue: true },
        _avg: { orderValue: true },
        where: { tenantId, customerId: cust.id },
      });
      const csAgg = await this.prisma.biFactCustomerService.aggregate({
        _avg: { csatRating: true },
        _sum: { ticketCount: true, slaBreachedCount: true },
        where: { tenantId, customerId: cust.id },
      });

      const features = {
        totalSpend: Number(salesAgg._sum.orderValue || 0.0),
        avgOrderValue: Number(salesAgg._avg.orderValue || 0.0),
        avgCsat: Number(csAgg._avg.csatRating || 5.0),
        ticketCount: Number(csAgg._sum.ticketCount || 0),
        slaBreaches: Number(csAgg._sum.slaBreachedCount || 0),
      };

      await this.prisma.aiFeatureStore.upsert({
        where: {
          tenantId_entityType_entityId_featureGroup: {
            tenantId,
            entityType: "CUSTOMER",
            entityId: cust.id,
            featureGroup: "customer_engagement",
          },
        },
        update: {
          features,
          version: { increment: 1 },
        },
        create: {
          tenantId,
          entityType: "CUSTOMER",
          entityId: cust.id,
          featureGroup: "customer_engagement",
          features,
        },
      });
    }

    // 3. Log Audit Event
    await this.auditService.log({
      action: "AI_FEATURE_STORE_SYNCED",
      entity: "AiFeatureStore",
      entityId: tenantId,
      newValues: {
        syncedProducts: products.length,
        syncedCustomers: customers.length,
      },
    });

    return {
      success: true,
      productsSynced: products.length,
      customersSynced: customers.length,
    };
  }

  async getFeatures(
    tenantId: string,
    entityType: string,
    entityId: string,
    featureGroup: string,
  ): Promise<Record<string, any>> {
    const record = await this.prisma.aiFeatureStore.findUnique({
      where: {
        tenantId_entityType_entityId_featureGroup: {
          tenantId,
          entityType,
          entityId,
          featureGroup,
        },
      },
    });
    return (record?.features as Record<string, any>) || {};
  }
}
