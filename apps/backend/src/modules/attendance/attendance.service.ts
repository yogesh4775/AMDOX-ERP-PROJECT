import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  Prisma,
  AttendanceStatus,
  CorrectionStatus,
  EmployeeStatus,
} from "@amdox/database/generated";
import { CreatePolicyDto } from "./dto/create-policy.dto";
import { CreateShiftDto } from "./dto/create-shift.dto";
import { AssignShiftDto } from "./dto/assign-shift.dto";
import { CheckInOutDto } from "./dto/check-in-out.dto";
import { RequestCorrectionDto } from "./dto/request-correction.dto";
import { QueryAttendanceDto } from "./dto/query-attendance.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- ATTENDANCE POLICIES ---
  async createPolicy(dto: CreatePolicyDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    if (dto.gracePeriodMinutes !== undefined && dto.gracePeriodMinutes < 0) {
      throw new BadRequestException("Grace period minutes cannot be negative.");
    }

    if (dto.halfDayHours !== undefined && dto.halfDayHours <= 0) {
      throw new BadRequestException(
        "Half-day hours must be greater than zero.",
      );
    }

    if (
      dto.fullDayHours !== undefined &&
      dto.halfDayHours !== undefined &&
      dto.fullDayHours <= dto.halfDayHours
    ) {
      throw new BadRequestException(
        "Full-day hours must be greater than half-day hours.",
      );
    }

    // Uniqueness checks
    const dup = await this.prisma.attendancePolicy.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (dup) {
      throw new BadRequestException(
        `Policy with name ${dto.name} already exists.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // If setting default, unset others
      if (dto.isDefault) {
        await tx.attendancePolicy.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const policy = await tx.attendancePolicy.create({
        data: {
          tenantId,
          name: dto.name,
          gracePeriodMinutes: dto.gracePeriodMinutes ?? 15,
          halfDayHours: new Prisma.Decimal(dto.halfDayHours ?? 4.0),
          fullDayHours: new Prisma.Decimal(dto.fullDayHours ?? 8.0),
          isDefault: dto.isDefault ?? false,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "ATTENDANCE_POLICY_CREATED",
          entity: "AttendancePolicy",
          entityId: policy.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(policy)),
        },
      });

      return policy;
    });
  }

  // --- SHIFT MANAGEMENT ---
  async createShift(dto: CreateShiftDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const dupCode = await this.prisma.shift.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (dupCode) {
      throw new BadRequestException(`Shift code ${dto.code} already exists.`);
    }

    const dupName = await this.prisma.shift.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (dupName) {
      throw new BadRequestException(`Shift name ${dto.name} already exists.`);
    }

    const shift = await this.prisma.shift.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    await this.auditService.log({
      action: "SHIFT_CREATED",
      entity: "Shift",
      entityId: shift.id,
      tenantId,
      userId: user.id,
      newValues: shift,
    });

    return shift;
  }

  // --- SHIFT ASSIGNMENTS ---
  async assignShift(dto: AssignShiftDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const emp = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!emp || emp.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException(
        "Employee must be active and belong to the same tenant.",
      );
    }

    const shift = await this.prisma.shift.findFirst({
      where: { id: dto.shiftId, tenantId },
    });
    if (!shift) {
      throw new BadRequestException(
        "Shift does not exist or belongs to a different tenant.",
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException("End date cannot be before start date.");
    }

    // Check for overlaps
    const overlaps = await this.prisma.shiftAssignment.findMany({
      where: {
        tenantId,
        employeeId: dto.employeeId,
      },
    });

    for (const a of overlaps) {
      const aStart = new Date(a.startDate);
      const aEnd = a.endDate ? new Date(a.endDate) : null;

      // Overlap logic:
      // (StartA <= EndB) and (EndA >= StartB)
      const cond1 = startDate <= (aEnd || new Date(9999, 11, 31));
      const cond2 = (endDate || new Date(9999, 11, 31)) >= aStart;

      if (cond1 && cond2) {
        throw new BadRequestException(
          "Overlapping shift assignment detected for this employee.",
        );
      }
    }

    const assignment = await this.prisma.shiftAssignment.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        shiftId: dto.shiftId,
        startDate,
        endDate,
      },
    });

    await this.auditService.log({
      action: "SHIFT_ASSIGNED",
      entity: "ShiftAssignment",
      entityId: assignment.id,
      tenantId,
      userId: user.id,
      newValues: assignment,
    });

    await this.notificationsService.createInternal({
      userId: user.id,
      tenantId,
      title: "Shift Assigned",
      message: `Shift assigned to Employee ID ${dto.employeeId}.`,
      type: NotificationType.INFO,
    });

    return assignment;
  }

  // --- CHECK-IN / CHECK-OUT LOGIC ---
  private parseTime(timeStr: string): { hour: number; minute: number } {
    const parts = timeStr.split(":");
    return {
      hour: parseInt(parts[0], 10),
      minute: parseInt(parts[1], 10),
    };
  }

  private isOvernight(shift: { startTime: string; endTime: string }): boolean {
    const start = this.parseTime(shift.startTime);
    const end = this.parseTime(shift.endTime);
    return (
      start.hour > end.hour ||
      (start.hour === end.hour && start.minute > end.minute)
    );
  }

  determineRecordDate(
    timestamp: Date,
    shift: { startTime: string; endTime: string },
  ): Date {
    const date = new Date(timestamp);
    if (this.isOvernight(shift)) {
      // If check-in is before noon (12:00), it belongs to the previous day's shift
      if (date.getUTCHours() < 12) {
        date.setUTCDate(date.getUTCDate() - 1);
      }
    }
    // Zero out hours/minutes
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  async checkIn(dto: CheckInOutDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const ts = new Date(dto.timestamp);

    // Get active shift assignment
    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: {
        tenantId,
        employeeId: dto.employeeId,
        startDate: { lte: ts },
        OR: [{ endDate: null }, { endDate: { gte: ts } }],
      },
      include: { shift: true },
    });
    if (!assignment) {
      throw new BadRequestException(
        "No active shift assignment found for this timestamp.",
      );
    }

    const shift = assignment.shift;
    const recordDate = this.determineRecordDate(ts, shift);

    // Check duplicate check-in
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: { tenantId, employeeId: dto.employeeId, date: recordDate },
    });
    if (existing && existing.checkIn) {
      throw new BadRequestException(
        "Employee has already checked in for this date/shift.",
      );
    }

    // Determine late check-in
    const shiftStartHour = this.parseTime(shift.startTime);
    const shiftStart = new Date(recordDate);
    shiftStart.setUTCHours(shiftStartHour.hour, shiftStartHour.minute, 0, 0);

    const policy = (await this.prisma.attendancePolicy.findFirst({
      where: { tenantId, isDefault: true },
    })) || { gracePeriodMinutes: 15 };

    const graceLimit = new Date(
      shiftStart.getTime() + policy.gracePeriodMinutes * 60 * 1000,
    );
    const isLate = ts > graceLimit;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      let record;
      if (existing) {
        record = await tx.attendanceRecord.update({
          where: { id: existing.id },
          data: {
            checkIn: ts,
            isLate,
            status: AttendanceStatus.PRESENT,
          },
        });
      } else {
        record = await tx.attendanceRecord.create({
          data: {
            tenantId,
            employeeId: dto.employeeId,
            date: recordDate,
            checkIn: ts,
            isLate,
            status: AttendanceStatus.PRESENT,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_CHECKED_IN",
          entity: "AttendanceRecord",
          entityId: record.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(record)),
        },
      });

      return record;
    });
  }

  async checkOut(dto: CheckInOutDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const ts = new Date(dto.timestamp);

    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: {
        tenantId,
        employeeId: dto.employeeId,
        startDate: { lte: ts },
        OR: [{ endDate: null }, { endDate: { gte: ts } }],
      },
      include: { shift: true },
    });
    if (!assignment) {
      throw new BadRequestException(
        "No active shift assignment found for this timestamp.",
      );
    }

    const shift = assignment.shift;
    const recordDate = this.determineRecordDate(ts, shift);

    const record = await this.prisma.attendanceRecord.findFirst({
      where: { tenantId, employeeId: dto.employeeId, date: recordDate },
    });
    if (!record || !record.checkIn) {
      throw new BadRequestException(
        "Employee must check in before checking out.",
      );
    }
    if (record.checkOut) {
      throw new BadRequestException(
        "Employee has already checked out for this date/shift.",
      );
    }

    if (ts < new Date(record.checkIn)) {
      throw new BadRequestException(
        "Checkout time cannot be before checkin time.",
      );
    }

    // Determine early checkout
    const shiftEndHour = this.parseTime(shift.endTime);
    const shiftEnd = new Date(recordDate);
    if (this.isOvernight(shift)) {
      shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
    }
    shiftEnd.setUTCHours(shiftEndHour.hour, shiftEndHour.minute, 0, 0);
    const isEarlyOut = ts < shiftEnd;

    // Recalculate parameters
    const checkInTime = new Date(record.checkIn).getTime();
    const checkOutTime = ts.getTime();
    const workingHours = Number(
      ((checkOutTime - checkInTime) / (1000 * 60 * 60)).toFixed(2),
    );

    // Shift length hours
    const shiftStartHour = this.parseTime(shift.startTime);
    const shiftStart = new Date(recordDate);
    shiftStart.setUTCHours(shiftStartHour.hour, shiftStartHour.minute, 0, 0);
    const shiftLengthHours =
      (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

    let overtimeHours = 0;
    if (workingHours > shiftLengthHours) {
      overtimeHours = Number((workingHours - shiftLengthHours).toFixed(2));
    }

    const policy = (await this.prisma.attendancePolicy.findFirst({
      where: { tenantId, isDefault: true },
    })) || { halfDayHours: 4.0, fullDayHours: 8.0 };

    let status: AttendanceStatus = AttendanceStatus.ABSENT;
    if (workingHours >= Number(policy.fullDayHours)) {
      status = AttendanceStatus.PRESENT;
    } else if (workingHours >= Number(policy.halfDayHours)) {
      status = AttendanceStatus.HALF_DAY;
    }

    // Check Holiday calendar
    const isHol = await this.prisma.holiday.findFirst({
      where: { tenantId, date: recordDate },
    });
    if (isHol && status === AttendanceStatus.ABSENT) {
      status = AttendanceStatus.HOLIDAY;
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          checkOut: ts,
          workingHours: new Prisma.Decimal(workingHours),
          overtimeHours: new Prisma.Decimal(overtimeHours),
          isEarlyOut,
          status,
          version: record.version + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_CHECKED_OUT",
          entity: "AttendanceRecord",
          entityId: record.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updated)),
        },
      });

      return updated;
    });
  }

  // --- ATTENDANCE CORRECTIONS ---
  async requestCorrection(
    recordId: string,
    dto: RequestCorrectionDto,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const record = await this.prisma.attendanceRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!record) {
      throw new NotFoundException(
        `Attendance record with ID ${recordId} not found.`,
      );
    }

    const reqCheckIn = dto.requestedCheckIn
      ? new Date(dto.requestedCheckIn)
      : null;
    const reqCheckOut = dto.requestedCheckOut
      ? new Date(dto.requestedCheckOut)
      : null;

    if (reqCheckIn && reqCheckOut && reqCheckOut < reqCheckIn) {
      throw new BadRequestException(
        "Requested check-out cannot be before check-in.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const corr = await tx.attendanceCorrection.create({
        data: {
          tenantId,
          attendanceRecordId: recordId,
          requestedCheckIn: reqCheckIn,
          requestedCheckOut: reqCheckOut,
          reason: dto.reason,
          status: CorrectionStatus.PENDING,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "ATTENDANCE_CORRECTION_REQUESTED",
          entity: "AttendanceCorrection",
          entityId: corr.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(corr)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Correction Requested",
        message: `Attendance correction requested for Employee ID ${record.employeeId}.`,
        type: NotificationType.INFO,
      });

      return corr;
    });
  }

  async approveCorrection(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    const corr = await this.prisma.attendanceCorrection.findFirst({
      where: { id, tenantId },
      include: { attendanceRecord: true },
    });
    if (!corr) {
      throw new NotFoundException(
        `Correction request with ID ${id} not found.`,
      );
    }

    if (corr.status !== CorrectionStatus.PENDING) {
      throw new BadRequestException(
        "Correction request has already been processed.",
      );
    }

    // Retrieve active shift to recalculate details
    const record = corr.attendanceRecord;
    const refTime = corr.requestedCheckIn || record.checkIn;
    if (!refTime) {
      throw new BadRequestException(
        "Cannot compute shift assignment without checkin timestamps.",
      );
    }

    const assignment = await this.prisma.shiftAssignment.findFirst({
      where: {
        tenantId,
        employeeId: record.employeeId,
        startDate: { lte: refTime },
        OR: [{ endDate: null }, { endDate: { gte: refTime } }],
      },
      include: { shift: true },
    });
    if (!assignment) {
      throw new BadRequestException(
        "No active shift assignment found for calculation.",
      );
    }
    const shift = assignment.shift;

    // Recalculations
    const checkIn = corr.requestedCheckIn || record.checkIn;
    const checkOut = corr.requestedCheckOut || record.checkOut;

    let workingHours = 0;
    let overtimeHours = 0;
    let isLate = false;
    let isEarlyOut = false;

    const policy = (await this.prisma.attendancePolicy.findFirst({
      where: { tenantId, isDefault: true },
    })) || { gracePeriodMinutes: 15, halfDayHours: 4.0, fullDayHours: 8.0 };

    if (checkIn) {
      const shiftStartHour = this.parseTime(shift.startTime);
      const shiftStart = new Date(record.date);
      shiftStart.setUTCHours(shiftStartHour.hour, shiftStartHour.minute, 0, 0);

      const graceLimit = new Date(
        shiftStart.getTime() + policy.gracePeriodMinutes * 60 * 1000,
      );
      isLate = checkIn > graceLimit;
    }

    if (checkIn && checkOut) {
      workingHours = Number(
        ((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(
          2,
        ),
      );

      const shiftEndHour = this.parseTime(shift.endTime);
      const shiftEnd = new Date(record.date);
      if (this.isOvernight(shift)) {
        shiftEnd.setUTCDate(shiftEnd.getUTCDate() + 1);
      }
      shiftEnd.setUTCHours(shiftEndHour.hour, shiftEndHour.minute, 0, 0);
      isEarlyOut = checkOut < shiftEnd;

      const shiftStartHour = this.parseTime(shift.startTime);
      const shiftStart = new Date(record.date);
      shiftStart.setUTCHours(shiftStartHour.hour, shiftStartHour.minute, 0, 0);
      const shiftLengthHours =
        (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

      if (workingHours > shiftLengthHours) {
        overtimeHours = Number((workingHours - shiftLengthHours).toFixed(2));
      }
    }

    let status: AttendanceStatus = AttendanceStatus.ABSENT;
    if (workingHours >= Number(policy.fullDayHours)) {
      status = AttendanceStatus.PRESENT;
    } else if (workingHours >= Number(policy.halfDayHours)) {
      status = AttendanceStatus.HALF_DAY;
    }

    // Check Holiday calendar
    const isHol = await this.prisma.holiday.findFirst({
      where: { tenantId, date: record.date },
    });
    if (isHol && status === AttendanceStatus.ABSENT) {
      status = AttendanceStatus.HOLIDAY;
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updatedCorr = await tx.attendanceCorrection.update({
        where: { id },
        data: {
          status: CorrectionStatus.APPROVED,
          approvedById: user.id,
          version: corr.version + 1,
        },
      });

      const updatedRecord = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          checkIn,
          checkOut,
          workingHours: new Prisma.Decimal(workingHours),
          overtimeHours: new Prisma.Decimal(overtimeHours),
          isLate,
          isEarlyOut,
          status,
          version: record.version + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "ATTENDANCE_CORRECTION_APPROVED",
          entity: "AttendanceCorrection",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updatedCorr)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Correction Approved",
        message: `Correction request approved for record ID ${record.id}.`,
        type: NotificationType.INFO,
      });

      return { correction: updatedCorr, record: updatedRecord };
    });
  }

  async rejectCorrection(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    const corr = await this.prisma.attendanceCorrection.findFirst({
      where: { id, tenantId },
    });
    if (!corr) {
      throw new NotFoundException(
        `Correction request with ID ${id} not found.`,
      );
    }

    if (corr.status !== CorrectionStatus.PENDING) {
      throw new BadRequestException(
        "Correction request has already been processed.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.attendanceCorrection.update({
        where: { id },
        data: {
          status: CorrectionStatus.REJECTED,
          version: corr.version + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "ATTENDANCE_CORRECTION_REJECTED",
          entity: "AttendanceCorrection",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updated)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Correction Rejected",
        message: `Correction request rejected for ID ${id}.`,
        type: NotificationType.INFO,
      });

      return updated;
    });
  }

  // --- QUERY ATTENDANCE RECORDS ---
  async getRecords(query: QueryAttendanceDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const where: Prisma.AttendanceRecordWhereInput = {
      tenantId,
    };

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.date) {
      where.date = new Date(query.date);
    }

    return this.prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: { date: "desc" },
    });
  }

  // --- ATTENDANCE DASHBOARD ---
  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const totalEmployees = await this.prisma.employee.count({
      where: { tenantId, status: EmployeeStatus.ACTIVE, deletedAt: null },
    });

    const present = await this.prisma.attendanceRecord.count({
      where: {
        tenantId,
        date: today,
        status: { in: [AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY] },
      },
    });

    const absent = totalEmployees > present ? totalEmployees - present : 0;

    const late = await this.prisma.attendanceRecord.count({
      where: {
        tenantId,
        date: today,
        isLate: true,
      },
    });

    const earlyOut = await this.prisma.attendanceRecord.count({
      where: {
        tenantId,
        date: today,
        isEarlyOut: true,
      },
    });

    // Overtime hours today
    const otGroup = await this.prisma.attendanceRecord.aggregate({
      where: { tenantId, date: today },
      _sum: { overtimeHours: true },
    });
    const overtimeHours = otGroup._sum.overtimeHours
      ? otGroup._sum.overtimeHours.toNumber()
      : 0;

    const pendingCorrections = await this.prisma.attendanceCorrection.count({
      where: { tenantId, status: CorrectionStatus.PENDING },
    });

    return {
      presentToday: present,
      absentToday: absent,
      lateEmployees: late,
      earlyDepartures: earlyOut,
      overtimeHoursToday: overtimeHours,
      pendingCorrections,
    };
  }
}
