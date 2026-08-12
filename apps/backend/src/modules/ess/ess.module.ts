import { Module } from "@nestjs/common";
import { PrismaModule } from "@amdox/database";
import { AuditModule } from "../../common/audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { HRMModule } from "../hrm/hrm.module";
import { AttendanceModule } from "../attendance/attendance.module";
import { LeaveModule } from "../leave/leave.module";
import { PayrollModule } from "../payroll/payroll.module";
import { ExpenseModule } from "../expense/expense.module";
import { PmsModule } from "../pms/pms.module";
import { MediaModule } from "../media/media.module";
import { EssService } from "./ess.service";
import { EssController } from "./ess.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    NotificationsModule,
    HRMModule,
    AttendanceModule,
    LeaveModule,
    PayrollModule,
    ExpenseModule,
    PmsModule,
    MediaModule,
  ],
  controllers: [EssController],
  providers: [EssService],
  exports: [EssService],
})
export class EssModule {}
