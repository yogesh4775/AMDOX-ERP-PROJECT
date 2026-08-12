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
  LeaveRequestStatus,
  LeaveApprovalStatus,
  EmployeeStatus,
  AttendanceStatus,
} from "@amdox/database/generated";
import { CreateLeaveTypeDto } from "./dto/create-leave-type.dto";
import { RequestLeaveDto } from "./dto/request-leave.dto";
import { QueryLeaveDto } from "./dto/query-leave.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- LEAVE TYPES & POLICIES ---
  async createLeaveType(dto: CreateLeaveTypeDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    if (dto.maxDaysPerYear <= 0) {
      throw new BadRequestException(
        "Maximum yearly leave must be greater than zero.",
      );
    }
    if (dto.accrualRateMonthly !== undefined && dto.accrualRateMonthly < 0) {
      throw new BadRequestException("Monthly accrual rate cannot be negative.");
    }
    if (dto.maxCarryForward !== undefined && dto.maxCarryForward < 0) {
      throw new BadRequestException("Carry forward amount cannot be negative.");
    }

    const dupCode = await this.prisma.leaveType.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (dupCode) {
      throw new BadRequestException(
        `Leave type code ${dto.code} already exists.`,
      );
    }

    const dupName = await this.prisma.leaveType.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (dupName) {
      throw new BadRequestException(
        `Leave type name ${dto.name} already exists.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const leaveType = await tx.leaveType.create({
        data: {
          tenantId,
          name: dto.name,
          code: dto.code,
          isPaid: dto.isPaid ?? true,
          maxDaysPerYear: new Prisma.Decimal(dto.maxDaysPerYear),
          accrualRateMonthly: new Prisma.Decimal(dto.accrualRateMonthly ?? 0),
          maxCarryForward: new Prisma.Decimal(dto.maxCarryForward ?? 0),
          isSandwichRuleEnabled: dto.isSandwichRuleEnabled ?? false,
        },
      });

      // Create associated Policy
      const policy = await tx.leavePolicy.create({
        data: {
          tenantId,
          leaveTypeId: leaveType.id,
          maxConsecutiveDays: dto.maxConsecutiveDays ?? null,
          minNoticePeriodDays: dto.minNoticePeriodDays ?? 0,
          probationRestricted: dto.probationRestricted ?? false,
          noticePeriodRestricted: dto.noticePeriodRestricted ?? false,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "LEAVE_TYPE_CREATED",
          entity: "LeaveType",
          entityId: leaveType.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(leaveType)),
        },
      });

      await tx.auditLog.create({
        data: {
          action: "LEAVE_POLICY_CREATED",
          entity: "LeavePolicy",
          entityId: policy.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(policy)),
        },
      });

      return { leaveType, policy };
    });
  }

  // --- LEAVE BALANCES ---
  async allocateBalance(
    employeeId: string,
    leaveTypeId: string,
    allocatedDays: number,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const emp = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, deletedAt: null },
    });
    if (!emp) {
      throw new NotFoundException("Employee not found.");
    }

    const type = await this.prisma.leaveType.findFirst({
      where: { id: leaveTypeId, tenantId },
    });
    if (!type) {
      throw new NotFoundException("Leave type not found.");
    }

    if (allocatedDays < 0) {
      throw new BadRequestException("Allocation cannot be negative.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const balance = await tx.leaveBalance.upsert({
        where: {
          tenantId_employeeId_leaveTypeId: {
            tenantId,
            employeeId,
            leaveTypeId,
          },
        },
        create: {
          tenantId,
          employeeId,
          leaveTypeId,
          allocated: new Prisma.Decimal(allocatedDays),
        },
        update: {
          allocated: new Prisma.Decimal(allocatedDays),
        },
      });

      await tx.auditLog.create({
        data: {
          action: "LEAVE_BALANCE_UPDATED",
          entity: "LeaveBalance",
          entityId: balance.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(balance)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Leave Balance Allocated",
        message: `Allocated ${allocatedDays} days of ${type.name} to Employee ID ${employeeId}.`,
        type: NotificationType.INFO,
      });

      return balance;
    });
  }

  async runMonthlyAccrual(user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const activeEmployees = await tx.employee.findMany({
        where: { tenantId, status: EmployeeStatus.ACTIVE, deletedAt: null },
      });

      const types = await tx.leaveType.findMany({
        where: { tenantId, accrualRateMonthly: { gt: 0 } },
      });

      const results = [];

      for (const t of types) {
        for (const e of activeEmployees) {
          const bal = await tx.leaveBalance.findUnique({
            where: {
              tenantId_employeeId_leaveTypeId: {
                tenantId,
                employeeId: e.id,
                leaveTypeId: t.id,
              },
            },
          });

          const currentAccrued = bal ? bal.accrued.toNumber() : 0;
          const currentAllocated = bal ? bal.allocated.toNumber() : 0;
          const accrualRate = t.accrualRateMonthly.toNumber();
          const maxLimit = t.maxDaysPerYear.toNumber();

          const totalPossible = currentAllocated + currentAccrued + accrualRate;
          let added = accrualRate;
          if (totalPossible > maxLimit) {
            added = Math.max(0, maxLimit - (currentAllocated + currentAccrued));
          }

          if (added > 0) {
            await tx.leaveBalance.upsert({
              where: {
                tenantId_employeeId_leaveTypeId: {
                  tenantId,
                  employeeId: e.id,
                  leaveTypeId: t.id,
                },
              },
              create: {
                tenantId,
                employeeId: e.id,
                leaveTypeId: t.id,
                allocated: new Prisma.Decimal(0),
                accrued: new Prisma.Decimal(added),
              },
              update: {
                accrued: new Prisma.Decimal(currentAccrued + added),
                version: bal ? bal.version + 1 : 1,
              },
            });

            const hist = await tx.leaveAccrualHistory.create({
              data: {
                tenantId,
                employeeId: e.id,
                leaveTypeId: t.id,
                amount: new Prisma.Decimal(added),
                date: new Date(),
              },
            });

            await tx.auditLog.create({
              data: {
                action: "LEAVE_ACCRUED",
                entity: "LeaveAccrualHistory",
                entityId: hist.id,
                tenantId,
                userId: user.id,
                newValues: JSON.parse(JSON.stringify(hist)),
              },
            });

            results.push(hist);
          }
        }
      }

      return results;
    });
  }

  async runCarryForward(user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const balances = await tx.leaveBalance.findMany({
        where: { tenantId },
        include: { leaveType: true },
      });

      const results = [];

      for (const b of balances) {
        const remaining =
          b.allocated.toNumber() + b.accrued.toNumber() - b.used.toNumber();
        if (remaining <= 0) continue;

        const maxCf = b.leaveType.maxCarryForward.toNumber();
        const cfAmount = Math.min(remaining, maxCf);

        if (cfAmount > 0) {
          await tx.leaveBalance.update({
            where: { id: b.id },
            data: {
              allocated: new Prisma.Decimal(cfAmount), // Reset allocated to Carry Forward amount
              accrued: new Prisma.Decimal(0),
              used: new Prisma.Decimal(0),
              version: b.version + 1,
            },
          });

          const hist = await tx.leaveCarryForwardHistory.create({
            data: {
              tenantId,
              employeeId: b.employeeId,
              leaveTypeId: b.leaveTypeId,
              amount: new Prisma.Decimal(cfAmount),
              date: new Date(),
            },
          });

          await tx.auditLog.create({
            data: {
              action: "LEAVE_CARRY_FORWARDED",
              entity: "LeaveCarryForwardHistory",
              entityId: hist.id,
              tenantId,
              userId: user.id,
              newValues: JSON.parse(JSON.stringify(hist)),
            },
          });

          results.push(hist);
        }
      }

      return results;
    });
  }

  // --- LEAVE DURATION & SANDWICH RULES ---
  private getDatesInRange(start: Date, end: Date): Date[] {
    const dates = [];
    const curr = new Date(start);
    while (curr <= end) {
      dates.push(new Date(curr));
      curr.setUTCDate(curr.getUTCDate() + 1);
    }
    return dates;
  }

  async calculateLeaveDuration(
    tenantId: string,
    leaveTypeId: string,
    startDate: Date,
    endDate: Date,
    isHalfDay: boolean,
  ): Promise<number> {
    if (isHalfDay) {
      return 0.5;
    }

    const type = await this.prisma.leaveType.findFirst({
      where: { id: leaveTypeId, tenantId },
    });
    if (!type) {
      throw new NotFoundException("Leave type not found.");
    }

    const dates = this.getDatesInRange(startDate, endDate);
    if (type.isSandwichRuleEnabled) {
      return dates.length;
    }

    // Exclude holidays and weekly offs
    const holidays = await this.prisma.holiday.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
      },
    });
    const holidayDates = holidays.map(
      (h) => h.date.toISOString().split("T")[0],
    );

    let count = 0;
    for (const d of dates) {
      const dayOfWeek = d.getUTCDay();
      const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      const isHol = holidayDates.includes(d.toISOString().split("T")[0]);

      if (!isWeeklyOff && !isHol) {
        count++;
      }
    }

    return count;
  }

  // --- LEAVE REQUESTS ---
  async requestLeave(dto: RequestLeaveDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (end < start) {
      throw new BadRequestException("End date cannot be before start date.");
    }

    const emp = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!emp || emp.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException("Employee must be active.");
    }

    // Check policy limits
    const policy = await this.prisma.leavePolicy.findFirst({
      where: { tenantId, leaveTypeId: dto.leaveTypeId },
    });
    if (policy) {
      if (policy.probationRestricted && emp.confirmationDate === null) {
        throw new BadRequestException("Leaves not allowed during probation.");
      }

      const daysRequested = await this.calculateLeaveDuration(
        tenantId,
        dto.leaveTypeId,
        start,
        end,
        dto.isHalfDay ?? false,
      );

      if (
        policy.maxConsecutiveDays &&
        daysRequested > policy.maxConsecutiveDays
      ) {
        throw new BadRequestException(
          `Maximum consecutive leave days for this type is ${policy.maxConsecutiveDays}.`,
        );
      }

      const daysNotice = Math.ceil(
        (start.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );
      if (
        policy.minNoticePeriodDays &&
        daysNotice < policy.minNoticePeriodDays
      ) {
        throw new BadRequestException(
          `Minimum notice period of ${policy.minNoticePeriodDays} days required.`,
        );
      }
    }

    // Check overlaps
    const overlaps = await this.prisma.leaveRequest.findMany({
      where: {
        tenantId,
        employeeId: dto.employeeId,
        status: {
          in: [LeaveRequestStatus.PENDING, LeaveRequestStatus.APPROVED],
        },
      },
    });

    for (const r of overlaps) {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate);

      const cond1 = start <= rEnd;
      const cond2 = end >= rStart;

      if (cond1 && cond2) {
        throw new BadRequestException(
          "Overlapping leave request detected for these dates.",
        );
      }
    }

    // Check leave balances
    const bal = await this.prisma.leaveBalance.findUnique({
      where: {
        tenantId_employeeId_leaveTypeId: {
          tenantId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
        },
      },
    });

    const currentBalance = bal
      ? bal.allocated.toNumber() + bal.accrued.toNumber() - bal.used.toNumber()
      : 0;
    const requestedDuration = await this.calculateLeaveDuration(
      tenantId,
      dto.leaveTypeId,
      start,
      end,
      dto.isHalfDay ?? false,
    );

    if (currentBalance < requestedDuration) {
      throw new BadRequestException("Insufficient leave balance available.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const req = await tx.leaveRequest.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          startDate: start,
          endDate: end,
          isHalfDay: dto.isHalfDay ?? false,
          reason: dto.reason,
          status: LeaveRequestStatus.PENDING,
          approvalStage: 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "LEAVE_REQUESTED",
          entity: "LeaveRequest",
          entityId: req.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(req)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Leave Requested",
        message: `Leave request submitted by Employee ID ${dto.employeeId}.`,
        type: NotificationType.INFO,
      });

      return req;
    });
  }

  // --- MULTI LEVEL APPROVALS ---
  async approveLeave(
    id: string,
    stage: number,
    comment: string | undefined,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const req = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
      include: { leaveType: true },
    });
    if (!req) {
      throw new NotFoundException(`Leave request with ID ${id} not found.`);
    }

    if (req.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException("Leave request is already processed.");
    }

    const isAutoLevel1 = req.approvalStage === 1 && stage === 2;

    if (req.approvalStage !== stage && !isAutoLevel1) {
      throw new BadRequestException(
        `Invalid approval stage: expected ${req.approvalStage}, got ${stage}.`,
      );
    }

    // Prevent duplicate approvals at same stage
    const dupApproval = await this.prisma.leaveApproval.findFirst({
      where: { tenantId, leaveRequestId: id, stage },
    });
    if (dupApproval) {
      throw new BadRequestException(
        `Leave stage ${stage} is already approved.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      if (isAutoLevel1) {
        // Create Level 1 Approval Record first
        await tx.leaveApproval.create({
          data: {
            tenantId,
            leaveRequestId: id,
            approverId: user.id,
            stage: 1,
            status: LeaveApprovalStatus.APPROVED,
            comment: "Auto-approved at Level 1 by final approver",
          },
        });
      }

      // Create Approval Record for requested stage
      await tx.leaveApproval.create({
        data: {
          tenantId,
          leaveRequestId: id,
          approverId: user.id,
          stage,
          status: LeaveApprovalStatus.APPROVED,
          comment,
        },
      });

      const nextStage = stage + 1;
      let finalStatus: LeaveRequestStatus = LeaveRequestStatus.PENDING;

      if (nextStage > 2) {
        finalStatus = LeaveRequestStatus.APPROVED;
      }

      const updatedReq = await tx.leaveRequest.update({
        where: { id },
        data: {
          approvalStage: nextStage > 2 ? 2 : nextStage,
          status: finalStatus,
          version: req.version + 1,
        },
      });

      if (finalStatus === LeaveRequestStatus.APPROVED) {
        // Deduct from Balance
        const bal = await tx.leaveBalance.findUnique({
          where: {
            tenantId_employeeId_leaveTypeId: {
              tenantId,
              employeeId: req.employeeId,
              leaveTypeId: req.leaveTypeId,
            },
          },
        });

        if (!bal) {
          throw new BadRequestException("Leave balance record missing.");
        }

        const requestedDuration = await this.calculateLeaveDuration(
          tenantId,
          req.leaveTypeId,
          new Date(req.startDate),
          new Date(req.endDate),
          req.isHalfDay,
        );

        await tx.leaveBalance.update({
          where: { id: bal.id },
          data: {
            used: new Prisma.Decimal(bal.used.toNumber() + requestedDuration),
            version: bal.version + 1,
          },
        });

        // Attendance Integration
        const dates = this.getDatesInRange(
          new Date(req.startDate),
          new Date(req.endDate),
        );
        const holidays = await tx.holiday.findMany({
          where: {
            tenantId,
            date: { gte: new Date(req.startDate), lte: new Date(req.endDate) },
          },
        });
        const holidayDates = holidays.map(
          (h) => h.date.toISOString().split("T")[0],
        );

        for (const d of dates) {
          const dayOfWeek = d.getUTCDay();
          const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;
          const isHol = holidayDates.includes(d.toISOString().split("T")[0]);

          // If sandwich rule is disabled, skip weekly off and holiday
          if (!req.leaveType.isSandwichRuleEnabled && (isWeeklyOff || isHol)) {
            continue;
          }

          const recordDate = new Date(d);
          recordDate.setUTCHours(0, 0, 0, 0);

          const existRecord = await tx.attendanceRecord.findFirst({
            where: { tenantId, employeeId: req.employeeId, date: recordDate },
          });

          const status = req.isHalfDay
            ? AttendanceStatus.HALF_DAY
            : AttendanceStatus.LEAVE;

          if (existRecord) {
            await tx.attendanceRecord.update({
              where: { id: existRecord.id },
              data: {
                status,
                version: existRecord.version + 1,
              },
            });
          } else {
            await tx.attendanceRecord.create({
              data: {
                tenantId,
                employeeId: req.employeeId,
                date: recordDate,
                status,
              },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: "LEAVE_APPROVED",
          entity: "LeaveRequest",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updatedReq)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Leave Approved",
        message: `Leave Request ID ${id} approved at Stage ${stage}.`,
        type: NotificationType.INFO,
      });

      return updatedReq;
    });
  }

  async rejectLeave(
    id: string,
    stage: number,
    comment: string | undefined,
    user: AuthUser,
  ) {
    const tenantId = user.tenantId!;

    const req = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!req) {
      throw new NotFoundException(`Leave request with ID ${id} not found.`);
    }

    if (req.status !== LeaveRequestStatus.PENDING) {
      throw new BadRequestException("Leave request is already processed.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      await tx.leaveApproval.create({
        data: {
          tenantId,
          leaveRequestId: id,
          approverId: user.id,
          stage,
          status: LeaveApprovalStatus.REJECTED,
          comment,
        },
      });

      const updatedReq = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveRequestStatus.REJECTED,
          version: req.version + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "LEAVE_REJECTED",
          entity: "LeaveRequest",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updatedReq)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Leave Rejected",
        message: `Leave Request ID ${id} rejected at Stage ${stage}.`,
        type: NotificationType.INFO,
      });

      return updatedReq;
    });
  }

  // --- LEAVE CANCELLATION ---
  async cancelLeave(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    const req = await this.prisma.leaveRequest.findFirst({
      where: { id, tenantId },
    });
    if (!req) {
      throw new NotFoundException(`Leave request with ID ${id} not found.`);
    }

    if (
      req.status === LeaveRequestStatus.CANCELLED ||
      req.status === LeaveRequestStatus.REJECTED
    ) {
      throw new BadRequestException(
        "Already processed or cancelled leave request.",
      );
    }

    const wasApproved = req.status === LeaveRequestStatus.APPROVED;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updatedReq = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveRequestStatus.CANCELLED,
          version: req.version + 1,
        },
      });

      if (wasApproved) {
        // Revert Balance
        const bal = await tx.leaveBalance.findUnique({
          where: {
            tenantId_employeeId_leaveTypeId: {
              tenantId,
              employeeId: req.employeeId,
              leaveTypeId: req.leaveTypeId,
            },
          },
        });

        if (bal) {
          const requestedDuration = await this.calculateLeaveDuration(
            tenantId,
            req.leaveTypeId,
            new Date(req.startDate),
            new Date(req.endDate),
            req.isHalfDay,
          );

          await tx.leaveBalance.update({
            where: { id: bal.id },
            data: {
              used: new Prisma.Decimal(
                Math.max(0, bal.used.toNumber() - requestedDuration),
              ),
              version: bal.version + 1,
            },
          });
        }

        // Attendance Reversion
        const dates = this.getDatesInRange(
          new Date(req.startDate),
          new Date(req.endDate),
        );
        for (const d of dates) {
          const recordDate = new Date(d);
          recordDate.setUTCHours(0, 0, 0, 0);

          const existRecord = await tx.attendanceRecord.findFirst({
            where: { tenantId, employeeId: req.employeeId, date: recordDate },
          });

          if (existRecord && existRecord.status === AttendanceStatus.LEAVE) {
            await tx.attendanceRecord.delete({
              where: { id: existRecord.id },
            });
          }
        }
      }

      await tx.auditLog.create({
        data: {
          action: "LEAVE_CANCELLED",
          entity: "LeaveRequest",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(updatedReq)),
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Leave Cancelled",
        message: `Leave Request ID ${id} has been cancelled.`,
        type: NotificationType.INFO,
      });

      return updatedReq;
    });
  }

  // --- AUTOMATIC COMP-OFF GENERATION ---
  async generateCompOffFromOvertime(employeeId: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Scan overtime totals for active employee
    const otGroup = await this.prisma.attendanceRecord.aggregate({
      where: {
        tenantId,
        employeeId,
        overtimeHours: { gt: 0 },
      },
      _sum: { overtimeHours: true },
    });

    const totalOt = otGroup._sum.overtimeHours
      ? otGroup._sum.overtimeHours.toNumber()
      : 0;
    // For every 8 hours of overtime, allocate 1 day of Comp-Off
    const earnedDays = Math.floor(totalOt / 8);

    if (earnedDays <= 0) {
      return {
        earnedDays: 0,
        message: "Insufficient overtime hours accumulated for Comp-Off.",
      };
    }

    // Find or create Comp-Off leave type
    let compType = await this.prisma.leaveType.findFirst({
      where: { tenantId, code: "COMP_OFF" },
    });

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      if (!compType) {
        compType = await tx.leaveType.create({
          data: {
            tenantId,
            name: "Compensatory Off",
            code: "COMP_OFF",
            maxDaysPerYear: new Prisma.Decimal(10.0),
          },
        });
      }

      const bal = await tx.leaveBalance.upsert({
        where: {
          tenantId_employeeId_leaveTypeId: {
            tenantId,
            employeeId,
            leaveTypeId: compType.id,
          },
        },
        create: {
          tenantId,
          employeeId,
          leaveTypeId: compType.id,
          allocated: new Prisma.Decimal(earnedDays),
        },
        update: {
          allocated: new Prisma.Decimal(earnedDays),
        },
      });

      return { earnedDays, balance: bal };
    });
  }

  // --- REUSABLE API FOR PAYROLL DEDUCTION ---
  async getUnpaidLeaveDays(
    employeeId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
        leaveType: { isPaid: false },
      },
    });

    let count = 0;
    for (const r of leaves) {
      const overlapStart = new Date(
        Math.max(new Date(r.startDate).getTime(), start.getTime()),
      );
      const overlapEnd = new Date(
        Math.min(new Date(r.endDate).getTime(), end.getTime()),
      );

      const duration = await this.calculateLeaveDuration(
        r.tenantId,
        r.leaveTypeId,
        overlapStart,
        overlapEnd,
        r.isHalfDay,
      );
      count += duration;
    }

    return count;
  }

  // --- TEAM CALENDAR & QUERIES ---
  async getLeaves(query: QueryLeaveDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const where: Prisma.LeaveRequestWhereInput = {
      tenantId,
    };

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }

    if (query.status) {
      where.status = query.status as LeaveRequestStatus;
    }

    if (query.departmentId) {
      where.employee = { departmentId: query.departmentId };
    }

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: true,
        leaveType: true,
      },
      orderBy: { startDate: "desc" },
    });
  }

  // --- LEAVE DASHBOARD ---
  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const approvedToday = await this.prisma.leaveRequest.count({
      where: {
        tenantId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    const pendingApprovals = await this.prisma.leaveRequest.count({
      where: { tenantId, status: LeaveRequestStatus.PENDING },
    });

    // Leave liability estimate: count sum of allocated remaining days for all employees
    const balGroup = await this.prisma.leaveBalance.findMany({
      where: { tenantId },
    });

    let totalRemainingDays = 0;
    for (const b of balGroup) {
      const rem =
        b.allocated.toNumber() + b.accrued.toNumber() - b.used.toNumber();
      totalRemainingDays += Math.max(0, rem);
    }

    return {
      approvedToday,
      pendingApprovals,
      companyLeaveLiabilityDays: totalRemainingDays,
    };
  }

  async onWorkflowComplete(
    tx: PrismaTx,
    tenantId: string,
    entityId: string,
    status: string,
    user: AuthUser,
  ) {
    const req = await tx.leaveRequest.findFirst({
      where: { id: entityId, tenantId },
      include: { leaveType: true },
    });
    if (!req) return;

    const finalStatus =
      status === "APPROVED"
        ? LeaveRequestStatus.APPROVED
        : LeaveRequestStatus.REJECTED;

    await tx.leaveRequest.update({
      where: { id: entityId },
      data: {
        status: finalStatus,
        version: req.version + 1,
      },
    });

    if (finalStatus === LeaveRequestStatus.APPROVED) {
      // Deduct from Balance
      const bal = await tx.leaveBalance.findUnique({
        where: {
          tenantId_employeeId_leaveTypeId: {
            tenantId,
            employeeId: req.employeeId,
            leaveTypeId: req.leaveTypeId,
          },
        },
      });

      if (!bal) {
        throw new BadRequestException("Leave balance record missing.");
      }

      const requestedDuration = await this.calculateLeaveDuration(
        tenantId,
        req.leaveTypeId,
        new Date(req.startDate),
        new Date(req.endDate),
        req.isHalfDay,
      );

      await tx.leaveBalance.update({
        where: { id: bal.id },
        data: {
          used: new Prisma.Decimal(bal.used.toNumber() + requestedDuration),
          version: bal.version + 1,
        },
      });

      // Attendance Integration
      const dates = this.getDatesInRange(
        new Date(req.startDate),
        new Date(req.endDate),
      );
      const holidays = await tx.holiday.findMany({
        where: {
          tenantId,
          date: { gte: new Date(req.startDate), lte: new Date(req.endDate) },
        },
      });
      const holidayDates = holidays.map(
        (h) => h.date.toISOString().split("T")[0],
      );

      for (const d of dates) {
        const dayOfWeek = d.getUTCDay();
        const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;
        const isHol = holidayDates.includes(d.toISOString().split("T")[0]);

        if (!req.leaveType.isSandwichRuleEnabled && (isWeeklyOff || isHol)) {
          continue;
        }

        const recordDate = new Date(d);
        recordDate.setUTCHours(0, 0, 0, 0);

        const existRecord = await tx.attendanceRecord.findFirst({
          where: { tenantId, employeeId: req.employeeId, date: recordDate },
        });

        const attStatus = req.isHalfDay
          ? AttendanceStatus.HALF_DAY
          : AttendanceStatus.LEAVE;

        if (existRecord) {
          await tx.attendanceRecord.update({
            where: { id: existRecord.id },
            data: {
              status: attStatus,
              version: existRecord.version + 1,
            },
          });
        } else {
          await tx.attendanceRecord.create({
            data: {
              tenantId,
              employeeId: req.employeeId,
              date: recordDate,
              status: attStatus,
            },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        action: status === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        entity: "LeaveRequest",
        entityId: entityId,
        tenantId,
        userId: user.id,
        newValues: { status: finalStatus },
      },
    });
  }
}
