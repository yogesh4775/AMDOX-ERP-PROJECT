import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { HealthModule } from "./health/health.module";
import { ConfigModule } from "./common/config/config.module";
import { LoggingMiddleware } from "./common/middleware/logging.middleware";
import { AuthModule } from "./modules/auth/auth.module";
import { TenantModule } from "./modules/tenants/tenant.module";
import { UsersModule } from "./modules/users/users.module";
import { RolesModule } from "./modules/roles/roles.module";
import { AuditModule } from "./common/audit/audit.module";
import { PermissionsModule } from "./modules/permissions/permissions.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { MediaModule } from "./modules/media/media.module";
import { ReportingModule } from "./modules/reporting/reporting.module";
import { MasterDataModule } from "./modules/master-data/master-data.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { PurchaseModule } from "./modules/purchase/purchase.module";
import { SalesModule } from "./modules/sales/sales.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AccountingModule } from "./modules/accounting/accounting.module";
import { FinancialReportingModule } from "./modules/financial-reporting/financial-reporting.module";
import { TaxModule } from "./modules/tax/tax.module";
import { FixedAssetsModule } from "./modules/fixed-assets/fixed-assets.module";
import { BankReconciliationModule } from "./modules/bank-reconciliation/bank-reconciliation.module";
import { BudgetingModule } from "./modules/budgeting/budgeting.module";
import { CRMModule } from "./modules/crm/crm.module";
import { HRMModule } from "./modules/hrm/hrm.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { LeaveModule } from "./modules/leave/leave.module";
import { PayrollModule } from "./modules/payroll/payroll.module";
import { ExpenseModule } from "./modules/expense/expense.module";
import { PmsModule } from "./modules/pms/pms.module";
import { EssModule } from "./modules/ess/ess.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";
import { ManufacturingModule } from "./modules/manufacturing/manufacturing.module";
import { QualityModule } from "./modules/quality/quality.module";
import { WmsModule } from "./modules/wms/wms.module";
import { TmsModule } from "./modules/tms/tms.module";
import { CsmModule } from "./modules/csm/csm.module";
import { BiModule } from "./modules/bi/bi.module";
import { AiModule } from "./modules/ai/ai.module";
import { IntegrationModule } from "./modules/integration/integration.module";
import { ConsolidationModule } from "./modules/consolidation/consolidation.module";
import { TransactionHelper } from "./common/transactions/transaction.helper";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    AuthModule,
    TenantModule,
    UsersModule,
    RolesModule,
    AuditModule,
    PermissionsModule,
    OrganizationModule,
    SessionsModule,
    DashboardModule,
    NotificationsModule,
    MediaModule,
    ReportingModule,
    MasterDataModule,
    InventoryModule,
    PurchaseModule,
    SalesModule,
    InvoicesModule,
    PaymentsModule,
    AccountingModule,
    FinancialReportingModule,
    TaxModule,
    FixedAssetsModule,
    BankReconciliationModule,
    BudgetingModule,
    CRMModule,
    HRMModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    ExpenseModule,
    PmsModule,
    EssModule,
    WorkflowModule,
    ManufacturingModule,
    QualityModule,
    WmsModule,
    TmsModule,
    CsmModule,
    BiModule,
    AiModule,
    IntegrationModule,
    ConsolidationModule,
  ],
  controllers: [],
  providers: [TransactionHelper],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes("*");
  }
}
