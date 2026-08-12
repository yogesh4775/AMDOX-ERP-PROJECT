/* eslint-disable */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { HRMService } from "../hrm/hrm.service";
import { AttendanceService } from "../attendance/attendance.service";
import { LeaveService } from "../leave/leave.service";
import { PayrollService } from "../payroll/payroll.service";
import { ExpenseService } from "../expense/expense.service";
import { PmsService } from "../pms/pms.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { CreateAnnouncementDto } from "./dto/create-announcement.dto";
import { EssRequestLeaveDto, EssCreateClaimDto } from "./dto/ess-requests.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  Prisma,
  EmployeeStatus,
  LeaveRequestStatus,
  ExpenseClaimStatus,
  GoalStatus,
  PerformanceReviewStatus,
  AttendanceStatus,
} from "@amdox/database/generated";

@Injectable()
export class EssService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly hrmService: HRMService,
    private readonly attendanceService: AttendanceService,
    private readonly leaveService: LeaveService,
    private readonly payrollService: PayrollService,
    private readonly expenseService: ExpenseService,
    private readonly pmsService: PmsService,
  ) {}

  // Helper to resolve employee by authenticated user email
  async getEmployeeForUser(user: AuthUser) {
    const tenantId = user.tenantId!;
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!userRecord) {
      throw new NotFoundException(`User record not found for user ID ${user.id}`);
    }
    const employee = await this.prisma.employee.findFirst({
      where: { email: userRecord.email, tenantId, deletedAt: null },
    });
    if (!employee) {
      throw new NotFoundException(`Employee profile not found for user ${userRecord.email}`);
    }
    return employee;
  }

  // --- Profile ---

  async getProfile(user: AuthUser) {
    const tenantId = user.tenantId!;
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!userRecord) {
      throw new NotFoundException(`User record not found.`);
    }
    const employee = await this.prisma.employee.findFirst({
      where: { email: userRecord.email, tenantId, deletedAt: null },
      include: {
        reportingManager: true,
        department: true,
        designation: true,
      },
    });
    if (!employee) {
      throw new NotFoundException(`Employee profile not found.`);
    }
    return employee;
  }

  async updateProfile(dto: UpdateProfileDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    if (employee.version !== dto.expectedVersion) {
      throw new ConflictException("DATABASE.CONFLICT");
    }

    const data: Prisma.EmployeeUpdateInput = {};
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.emergencyContactName !== undefined) data.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined) data.emergencyContactPhone = dto.emergencyContactPhone;
    if (dto.profilePhoto !== undefined) data.profilePhoto = dto.profilePhoto;

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...data,
        version: employee.version + 1,
      },
    });

    await this.auditService.log({
      action: "PROFILE_UPDATED",
      entity: "Employee",
      entityId: employee.id,
      tenantId,
      userId: user.id,
      oldValues: JSON.parse(JSON.stringify(employee)),
      newValues: JSON.parse(JSON.stringify(updated)),
    });

    return updated;
  }

  async updateProfilePhoto(url: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        profilePhoto: url,
        version: employee.version + 1,
      },
    });

    await this.auditService.log({
      action: "PROFILE_UPDATED",
      entity: "Employee",
      entityId: employee.id,
      tenantId,
      userId: user.id,
      oldValues: JSON.parse(JSON.stringify(employee)),
      newValues: JSON.parse(JSON.stringify(updated)),
    });

    return updated;
  }

  // --- Attendance ---

  async getAttendanceHistory(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    return this.prisma.attendanceRecord.findMany({
      where: { employeeId: employee.id, tenantId },
      orderBy: { date: "desc" },
    });
  }

  async checkIn(dto: { timestamp: string }, user: AuthUser) {
    const employee = await this.getEmployeeForUser(user);
    return this.attendanceService.checkIn({
      employeeId: employee.id,
      timestamp: dto.timestamp,
    }, user);
  }

  async checkOut(dto: { timestamp: string }, user: AuthUser) {
    const employee = await this.getEmployeeForUser(user);
    return this.attendanceService.checkOut({
      employeeId: employee.id,
      timestamp: dto.timestamp,
    }, user);
  }

  // --- Leave ---

  async getLeaveBalances(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    return this.prisma.leaveBalance.findMany({
      where: { employeeId: employee.id, tenantId },
      include: { leaveType: true },
    });
  }

  async getLeaveRequests(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    return this.prisma.leaveRequest.findMany({
      where: { employeeId: employee.id, tenantId },
      include: { leaveType: true },
      orderBy: { startDate: "desc" },
    });
  }

  async applyLeave(dto: EssRequestLeaveDto, user: AuthUser) {
    const employee = await this.getEmployeeForUser(user);
    const result = await this.leaveService.requestLeave({
      ...dto,
      employeeId: employee.id,
    }, user);

    // Notify of new leave request (optional notification or internal system event)
    return result;
  }

  async cancelLeave(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    const leaveRequest = await this.prisma.leaveRequest.findFirst({
      where: { id, employeeId: employee.id, tenantId },
    });
    if (!leaveRequest) {
      throw new NotFoundException(`Leave request not found or unauthorized.`);
    }

    if (leaveRequest.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException("Only PENDING leave requests can be cancelled.");
    }

    return this.leaveService.cancelLeave(id, user);
  }

  // --- Payroll ---

  async getPayslips(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    return this.prisma.payslip.findMany({
      where: { employeeId: employee.id, tenantId },
      include: { payrollPeriod: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getPayslipPdf(id: string, user: AuthUser): Promise<Buffer> {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    const payslip = await this.prisma.payslip.findFirst({
      where: { id, employeeId: employee.id, tenantId },
    });
    if (!payslip) {
      throw new NotFoundException(`Payslip not found.`);
    }

    const buffer = await this.payrollService.exportPayslipPdf(id, user);

    await this.auditService.log({
      action: "PAYSLIP_DOWNLOADED",
      entity: "Payslip",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: { payslipId: id },
    });

    return buffer;
  }

  // --- Expense Claims ---

  async getExpenseClaims(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    return this.prisma.expenseClaim.findMany({
      where: { employeeId: employee.id, tenantId },
      include: { items: true },
      orderBy: { claimDate: "desc" },
    });
  }

  async createExpenseClaim(dto: EssCreateClaimDto, user: AuthUser) {
    const employee = await this.getEmployeeForUser(user);
    return this.expenseService.createClaim({
      ...dto,
      employeeId: employee.id,
    }, user);
  }

  async submitExpenseClaim(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id, employeeId: employee.id, tenantId },
    });
    if (!claim) {
      throw new NotFoundException(`Expense claim not found or unauthorized.`);
    }
    return this.expenseService.submitClaim(id, user);
  }

  // --- PMS Performance ---

  async getPmsGoals(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    return this.prisma.performanceGoal.findMany({
      where: { employeeId: employee.id, tenantId },
      include: { appraisalCycle: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async getPmsReviews(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);

    return this.prisma.performanceReview.findMany({
      where: { employeeId: employee.id, tenantId },
      include: { appraisalCycle: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async submitSelfReview(
    dto: { appraisalCycleId: string; selfScore: number; selfFeedback: string },
    user: AuthUser,
  ) {
    const result = await this.pmsService.submitSelfReview(dto, user);

    await this.auditService.log({
      action: "SELF_REVIEW_SUBMITTED",
      entity: "PerformanceReview",
      entityId: result.id,
      tenantId: user.tenantId!,
      userId: user.id,
      newValues: JSON.parse(JSON.stringify(result)),
    });

    return result;
  }

  // --- Company Announcements ---

  async getAnnouncements(user: AuthUser) {
    const tenantId = user.tenantId!;
    const now = new Date();

    return this.prisma.companyAnnouncement.findMany({
      where: {
        tenantId,
        publishDate: { lte: now },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: now } },
        ],
      },
      orderBy: { publishDate: "desc" },
    });
  }

  async createAnnouncement(dto: CreateAnnouncementDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const publishDate = new Date(dto.publishDate);
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : null;

    if (expiryDate && publishDate >= expiryDate) {
      throw new BadRequestException("Publish Date must be before Expiry Date.");
    }

    const announcement = await this.prisma.companyAnnouncement.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        publishDate,
        expiryDate,
      },
    });

    await this.auditService.log({
      action: "ANNOUNCEMENT_CREATED",
      entity: "CompanyAnnouncement",
      entityId: announcement.id,
      tenantId,
      userId: user.id,
      newValues: JSON.parse(JSON.stringify(announcement)),
    });

    // Notify employees of new announcement
    const employees = await this.prisma.employee.findMany({
      where: { tenantId, status: EmployeeStatus.ACTIVE, deletedAt: null },
    });
    for (const emp of employees) {
      // Find matching user
      const empUser = await this.prisma.user.findFirst({
        where: { email: emp.email, tenantId },
      });
      if (empUser) {
        await this.notificationsService.createInternal({
          userId: empUser.id,
          tenantId,
          title: "New Company Announcement",
          message: `A new company announcement has been published: "${dto.title}"`,
          type: NotificationType.INFO,
        });
      }
    }

    return announcement;
  }

  // --- Dashboard Summary ---

  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;
    const employee = await this.getEmployeeForUser(user);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 1. Today's Attendance
    const todayAttendance = await this.prisma.attendanceRecord.findFirst({
      where: { employeeId: employee.id, date: today, tenantId },
    });

    // 2. Leave Balance Sum
    const leaveBalances = await this.prisma.leaveBalance.findMany({
      where: { employeeId: employee.id, tenantId },
    });
    let remainingLeaves = 0;
    for (const b of leaveBalances) {
      remainingLeaves += b.allocated.toNumber() + b.accrued.toNumber() - b.used.toNumber();
    }

    // 3. Upcoming Holidays (next 5)
    const upcomingHolidays = await this.prisma.holiday.findMany({
      where: { tenantId, date: { gte: today } },
      orderBy: { date: "asc" },
      take: 5,
    });

    // 4. Pending Expense Claims
    const pendingClaims = await this.prisma.expenseClaim.findMany({
      where: { employeeId: employee.id, status: ExpenseClaimStatus.SUBMITTED, tenantId },
    });
    const pendingClaimsCount = pendingClaims.length;
    let pendingClaimsAmount = 0;
    for (const c of pendingClaims) {
      pendingClaimsAmount += Number(c.totalAmount);
    }

    // 5. Latest Payslip Net Pay
    const latestPayslip = await this.prisma.payslip.findFirst({
      where: { employeeId: employee.id, tenantId },
      orderBy: { createdAt: "desc" },
    });
    const latestPayslipNetPay = latestPayslip ? Number(latestPayslip.netPay) : 0;

    // 6. Active Goals Count
    const activeGoalsCount = await this.prisma.performanceGoal.count({
      where: { employeeId: employee.id, status: GoalStatus.PENDING, tenantId },
    });

    // 7. Pending Self Reviews Count
    const pendingSelfReviewsCount = await this.prisma.performanceReview.count({
      where: { employeeId: employee.id, status: PerformanceReviewStatus.DRAFT, tenantId },
    });

    // 8. Active Announcements Count
    const activeAnnouncementsCount = await this.prisma.companyAnnouncement.count({
      where: {
        tenantId,
        publishDate: { lte: new Date() },
        OR: [
          { expiryDate: null },
          { expiryDate: { gte: new Date() } },
        ],
      },
    });

    return {
      todayAttendanceStatus: todayAttendance ? todayAttendance.status : AttendanceStatus.ABSENT,
      todayCheckIn: todayAttendance?.checkIn || null,
      todayCheckOut: todayAttendance?.checkOut || null,
      remainingLeaves,
      upcomingHolidays: upcomingHolidays.map((h) => ({ name: h.name, date: h.date })),
      pendingClaimsCount,
      pendingClaimsAmount,
      latestPayslipNetPay,
      activeGoalsCount,
      pendingSelfReviewsCount,
      activeAnnouncementsCount,
    };
  }
}
