/* eslint-disable */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import {
  AppraisalCycleStatus,
  GoalStatus,
  PerformanceReviewStatus,
} from "@amdox/database/generated";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateCycleDto } from "./dto/create-cycle.dto";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";
import { SubmitSelfReviewDto } from "./dto/submit-self-review.dto";
import { SubmitManagerReviewDto } from "./dto/submit-manager-review.dto";
import { FinalizeReviewDto } from "./dto/finalize-review.dto";
import { QueryPmsDto } from "./dto/query-pms.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import { PrismaTx, TransactionHelper } from "../../common/transactions/transaction.helper";

@Injectable()
export class PmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- Appraisal Cycle Management ---

  async createCycle(dto: CreateCycleDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (startDate >= endDate) {
      throw new BadRequestException("Start Date must be before End Date.");
    }

    const existingCycleName = await this.prisma.appraisalCycle.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existingCycleName) {
      throw new BadRequestException("Cycle name must be unique per tenant.");
    }

    const cycle = await this.prisma.appraisalCycle.create({
      data: {
        tenantId,
        name: dto.name,
        startDate,
        endDate,
        status: AppraisalCycleStatus.DRAFT,
        version: 1,
      },
    });

    await this.auditService.log({
      action: "APPRAISAL_CYCLE_CREATED",
      entity: "AppraisalCycle",
      entityId: cycle.id,
      tenantId,
      userId: user.id,
      newValues: cycle,
    });

    return cycle;
  }

  async activateCycle(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx) => {
      const cycle = await tx.appraisalCycle.findFirst({
        where: { id, tenantId },
      });
      if (!cycle) {
        throw new NotFoundException(`Appraisal cycle ${id} not found.`);
      }

      if (cycle.status !== AppraisalCycleStatus.DRAFT) {
        throw new BadRequestException("Only DRAFT cycles can be activated.");
      }

      // Ensure no other active cycles exist
      const activeCycle = await tx.appraisalCycle.findFirst({
        where: { tenantId, status: AppraisalCycleStatus.ACTIVE },
      });
      if (activeCycle) {
        throw new BadRequestException("Only one ACTIVE cycle may exist at a time.");
      }

      // Check date overlaps with existing active/completed cycles
      const overlapping = await tx.appraisalCycle.findFirst({
        where: {
          tenantId,
          status: { in: [AppraisalCycleStatus.ACTIVE, AppraisalCycleStatus.COMPLETED] },
          OR: [
            {
              startDate: { lte: cycle.endDate },
              endDate: { gte: cycle.startDate },
            },
          ],
        },
      });
      if (overlapping) {
        throw new BadRequestException("Active cycles cannot overlap with existing cycles.");
      }

      const updated = await tx.appraisalCycle.update({
        where: { id },
        data: {
          status: AppraisalCycleStatus.ACTIVE,
          version: cycle.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "APPRAISAL_CYCLE_ACTIVATED",
          entity: "AppraisalCycle",
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

  async completeCycle(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx) => {
      const cycle = await tx.appraisalCycle.findFirst({
        where: { id, tenantId },
      });
      if (!cycle) {
        throw new NotFoundException(`Appraisal cycle ${id} not found.`);
      }

      if (cycle.status !== AppraisalCycleStatus.ACTIVE) {
        throw new BadRequestException("Only ACTIVE cycles can be completed.");
      }

      const updated = await tx.appraisalCycle.update({
        where: { id },
        data: {
          status: AppraisalCycleStatus.COMPLETED,
          version: cycle.version + 1,
        },
      });

      return updated;
    });
  }

  // --- Goal Management ---

  async createGoal(dto: CreateGoalDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx) => {
      // Fetch active cycle
      const activeCycle = await tx.appraisalCycle.findFirst({
        where: { tenantId, status: AppraisalCycleStatus.ACTIVE },
      });
      if (!activeCycle) {
        throw new BadRequestException("No active appraisal cycle exists.");
      }

      // Fetch employee
      const employee = await tx.employee.findFirst({
        where: { id: dto.employeeId, tenantId },
      });
      if (!employee || employee.status !== "ACTIVE") {
        throw new BadRequestException("Employee must be ACTIVE.");
      }

      // Verify manager belongs to same tenant
      if (employee.reportingManagerId) {
        const manager = await tx.employee.findFirst({
          where: { id: employee.reportingManagerId, tenantId },
        });
        if (!manager) {
          throw new BadRequestException("Manager must belong to the same tenant.");
        }
      }

      if (dto.weight <= 0 || dto.weight > 100) {
        throw new BadRequestException("Goal weight must be greater than 0 and less than or equal to 100.");
      }

      // Check duplicate goal title
      const duplicate = await tx.performanceGoal.findFirst({
        where: {
          tenantId,
          employeeId: dto.employeeId,
          appraisalCycleId: activeCycle.id,
          title: { equals: dto.title, mode: "insensitive" },
        },
      });
      if (duplicate) {
        throw new BadRequestException("Duplicate goals within the same appraisal cycle are blocked.");
      }

      // Check total goal weight
      const existingGoals = await tx.performanceGoal.findMany({
        where: {
          tenantId,
          employeeId: dto.employeeId,
          appraisalCycleId: activeCycle.id,
        },
      });
      const currentTotalWeight = existingGoals.reduce(
        (sum, g) => sum + Number(g.weight),
        0,
      );
      if (currentTotalWeight + dto.weight > 100) {
        throw new BadRequestException(
          `Total goal weight for an employee within one appraisal cycle must never exceed 100%. Current total: ${currentTotalWeight}%`,
        );
      }

      const goal = await tx.performanceGoal.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          appraisalCycleId: activeCycle.id,
          title: dto.title,
          description: dto.description || null,
          weight: dto.weight,
          status: GoalStatus.PENDING,
          version: 1,
        },
      });

      await this.auditService.log(
        {
          action: "GOAL_CREATED",
          entity: "PerformanceGoal",
          entityId: goal.id,
          tenantId,
          userId: user.id,
          newValues: goal,
        },
        tx,
      );

      // Notify Employee
      const empUser = await tx.user.findFirst({
        where: { email: employee.email, tenantId },
      });
      if (empUser) {
        await this.notificationsService.createInternal({
          userId: empUser.id,
          tenantId,
          title: "New Goal Assigned",
          message: `A new performance goal "${goal.title}" has been assigned to you.`,
          type: NotificationType.INFO,
        });
        console.log(
          `[EMAIL SENT] To: ${employee.email}, Subject: New Goal Assigned, Body: Goal "${goal.title}" has been assigned to you.`,
        );
      }

      return goal;
    });
  }

  async updateGoal(id: string, dto: UpdateGoalDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx) => {
      const goal = await tx.performanceGoal.findFirst({
        where: { id, tenantId },
      });
      if (!goal) {
        throw new NotFoundException(`Goal ${id} not found.`);
      }

      if (goal.version !== dto.expectedVersion) {
        throw new ConflictException("DATABASE.CONFLICT");
      }

      const updated = await tx.performanceGoal.update({
        where: { id },
        data: {
          status: dto.status,
          version: goal.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "GOAL_UPDATED",
          entity: "PerformanceGoal",
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

  // --- Self-Review ---

  async submitSelfReview(dto: SubmitSelfReviewDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx) => {
      // Find logged in user email
      const userRecord = await tx.user.findUnique({
        where: { id: user.id },
      });
      if (!userRecord) {
        throw new NotFoundException("User not found.");
      }

      const employee = await tx.employee.findFirst({
        where: { email: userRecord.email, tenantId },
      });
      if (!employee || employee.status !== "ACTIVE") {
        throw new BadRequestException("Active employee profile not found.");
      }

      // Fetch cycle
      const cycle = await tx.appraisalCycle.findFirst({
        where: { id: dto.appraisalCycleId, tenantId },
      });
      if (!cycle || cycle.status !== AppraisalCycleStatus.ACTIVE) {
        throw new BadRequestException("Review allowed only while cycle is ACTIVE.");
      }

      if (dto.selfScore < 1.00 || dto.selfScore > 5.00) {
        throw new BadRequestException("Score must be between 1.00 and 5.00.");
      }

      // Prevent duplicate self-reviews
      const existingReview = await tx.performanceReview.findFirst({
        where: {
          tenantId,
          employeeId: employee.id,
          appraisalCycleId: dto.appraisalCycleId,
        },
      });
      if (existingReview) {
        throw new BadRequestException("Employee may submit only one self-review per appraisal cycle.");
      }

      const review = await tx.performanceReview.create({
        data: {
          tenantId,
          employeeId: employee.id,
          appraisalCycleId: dto.appraisalCycleId,
          selfScore: dto.selfScore,
          selfFeedback: dto.selfFeedback,
          status: PerformanceReviewStatus.SUBMITTED,
          version: 1,
        },
      });

      await this.auditService.log(
        {
          action: "SELF_REVIEW_SUBMITTED",
          entity: "PerformanceReview",
          entityId: review.id,
          tenantId,
          userId: user.id,
          newValues: review,
        },
        tx,
      );

      // Notify Manager
      if (employee.reportingManagerId) {
        const managerEmp = await tx.employee.findFirst({
          where: { id: employee.reportingManagerId, tenantId },
        });
        if (managerEmp) {
          const managerUser = await tx.user.findFirst({
            where: { email: managerEmp.email, tenantId },
          });
          if (managerUser) {
            await this.notificationsService.createInternal({
              userId: managerUser.id,
              tenantId,
              title: "Self Review Submitted",
              message: `${employee.firstName} ${employee.lastName} has submitted their self-review.`,
              type: NotificationType.INFO,
            });
            console.log(
              `[EMAIL SENT] To: ${managerEmp.email}, Subject: Self Review Submitted, Body: ${employee.firstName} submitted self-review.`,
            );
          }
        }
      }

      return review;
    });
  }

  // --- Manager Review ---

  async submitManagerReview(id: string, dto: SubmitManagerReviewDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx) => {
      const review = await tx.performanceReview.findFirst({
        where: { id, tenantId },
        include: { employee: true },
      });
      if (!review) {
        throw new NotFoundException(`Performance review ${id} not found.`);
      }

      if (review.version !== dto.expectedVersion) {
        throw new ConflictException("DATABASE.CONFLICT");
      }

      if (review.status !== PerformanceReviewStatus.SUBMITTED) {
        throw new BadRequestException("Review cannot proceed unless employee submitted self-review.");
      }

      if (dto.managerScore < 1.00 || dto.managerScore > 5.00) {
        throw new BadRequestException("Manager score must be between 1.00 and 5.00.");
      }

      if (!dto.managerFeedback || dto.managerFeedback.trim() === "") {
        throw new BadRequestException("Manager feedback is mandatory.");
      }

      // Verify reporting manager
      const userRecord = await tx.user.findUnique({
        where: { id: user.id },
      });
      const managerEmp = await tx.employee.findFirst({
        where: { email: userRecord!.email, tenantId },
      });

      if (!managerEmp || review.employee.reportingManagerId !== managerEmp.id) {
        throw new ForbiddenException("Only the employee's reporting manager may review.");
      }

      const updated = await tx.performanceReview.update({
        where: { id },
        data: {
          managerScore: dto.managerScore,
          managerFeedback: dto.managerFeedback,
          status: PerformanceReviewStatus.MANAGER_REVIEWED,
          version: review.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "MANAGER_REVIEW_SUBMITTED",
          entity: "PerformanceReview",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: updated,
        },
        tx,
      );

      // Notify Employee
      const empUser = await tx.user.findFirst({
        where: { email: review.employee.email, tenantId },
      });
      if (empUser) {
        await this.notificationsService.createInternal({
          userId: empUser.id,
          tenantId,
          title: "Manager Review Completed",
          message: `Your manager has completed your performance review.`,
          type: NotificationType.INFO,
        });
        console.log(
          `[EMAIL SENT] To: ${review.employee.email}, Subject: Manager Review Completed, Body: Your manager has reviewed your performance.`,
        );
      }

      return updated;
    });
  }

  // --- HR Finalization ---

  async finalizeReview(id: string, dto: FinalizeReviewDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx) => {
      const review = await tx.performanceReview.findFirst({
        where: { id, tenantId },
        include: { employee: true },
      });
      if (!review) {
        throw new NotFoundException(`Performance review ${id} not found.`);
      }

      if (review.version !== dto.expectedVersion) {
        throw new ConflictException("DATABASE.CONFLICT");
      }

      if (review.status === PerformanceReviewStatus.COMPLETED) {
        throw new BadRequestException("Duplicate finalization is blocked.");
      }

      if (review.status !== PerformanceReviewStatus.MANAGER_REVIEWED) {
        throw new BadRequestException("Review must be reviewed by manager before finalization.");
      }

      if (dto.finalScore < 1.00 || dto.finalScore > 5.00) {
        throw new BadRequestException("Final score must be between 1.00 and 5.00.");
      }

      const updated = await tx.performanceReview.update({
        where: { id },
        data: {
          finalScore: dto.finalScore,
          status: PerformanceReviewStatus.COMPLETED,
          version: review.version + 1,
        },
      });

      await this.auditService.log(
        {
          action: "PERFORMANCE_FINALIZED",
          entity: "PerformanceReview",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: updated,
        },
        tx,
      );

      // Notify Employee
      const empUser = await tx.user.findFirst({
        where: { email: review.employee.email, tenantId },
      });
      if (empUser) {
        await this.notificationsService.createInternal({
          userId: empUser.id,
          tenantId,
          title: "Appraisal Finalized",
          message: `Your appraisal has been finalized with a score of ${dto.finalScore}.`,
          type: NotificationType.INFO,
        });
        console.log(
          `[EMAIL SENT] To: ${review.employee.email}, Subject: Appraisal Finalized, Body: Your appraisal is finalized.`,
        );
      }

      return updated;
    });
  }

  // --- Queries & Dashboard & Reporting ---

  async findAll(query: QueryPmsDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const where: any = { tenantId };

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.appraisalCycleId) {
      where.appraisalCycleId = query.appraisalCycleId;
    }
    if (query.status) {
      where.status = query.status as any;
    }

    return this.prisma.performanceReview.findMany({
      where,
      include: {
        employee: true,
        appraisalCycle: true,
      },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const review = await this.prisma.performanceReview.findFirst({
      where: { id, tenantId },
      include: {
        employee: true,
        appraisalCycle: true,
      },
    });
    if (!review) {
      throw new NotFoundException(`Review ${id} not found.`);
    }
    return review;
  }

  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;

    // 1. Active Appraisal Cycles count
    const activeCycles = await this.prisma.appraisalCycle.count({
      where: { tenantId, status: AppraisalCycleStatus.ACTIVE },
    });

    // 2. Pending Self Reviews: Active employees who don't have a review in the active cycle
    const activeCycle = await this.prisma.appraisalCycle.findFirst({
      where: { tenantId, status: AppraisalCycleStatus.ACTIVE },
    });

    let pendingSelfReviews = 0;
    let goalCompletionPct = 0;

    if (activeCycle) {
      const activeEmployeesCount = await this.prisma.employee.count({
        where: { tenantId, status: "ACTIVE" },
      });
      const submittedReviewsCount = await this.prisma.performanceReview.count({
        where: {
          tenantId,
          appraisalCycleId: activeCycle.id,
          status: { in: [PerformanceReviewStatus.SUBMITTED, PerformanceReviewStatus.MANAGER_REVIEWED, PerformanceReviewStatus.COMPLETED] },
        },
      });
      pendingSelfReviews = Math.max(0, activeEmployeesCount - submittedReviewsCount);

      // Goal completion percentage
      const totalGoals = await this.prisma.performanceGoal.count({
        where: { tenantId, appraisalCycleId: activeCycle.id },
      });
      const achievedGoals = await this.prisma.performanceGoal.count({
        where: { tenantId, appraisalCycleId: activeCycle.id, status: GoalStatus.ACHIEVED },
      });
      goalCompletionPct = totalGoals > 0 ? Math.round((achievedGoals / totalGoals) * 100) : 0;
    }

    // 3. Pending Manager Reviews
    const pendingManagerReviews = await this.prisma.performanceReview.count({
      where: { tenantId, status: PerformanceReviewStatus.SUBMITTED },
    });

    // 4. Completed Reviews
    const completedReviews = await this.prisma.performanceReview.count({
      where: { tenantId, status: PerformanceReviewStatus.COMPLETED },
    });

    // 5. Average Performance Score
    const avgScoreData = await this.prisma.performanceReview.aggregate({
      where: { tenantId, status: PerformanceReviewStatus.COMPLETED },
      _avg: {
        finalScore: true,
      },
    });
    const avgScore = avgScoreData._avg.finalScore ? Number(avgScoreData._avg.finalScore) : 0;

    return {
      activeAppraisalCycles: activeCycles,
      pendingSelfReviews,
      pendingManagerReviews,
      completedReviews,
      averagePerformanceScore: avgScore,
      goalCompletionPercentage: goalCompletionPct,
    };
  }

  async getPerformanceReport(query: QueryPmsDto, user: AuthUser) {
    const reviews = await this.findAll(query, user);
    return reviews.map((r) => ({
      reviewId: r.id,
      employeeCode: r.employee.employeeCode,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      cycleName: r.appraisalCycle.name,
      selfScore: r.selfScore ? Number(r.selfScore) : null,
      managerScore: r.managerScore ? Number(r.managerScore) : null,
      finalScore: r.finalScore ? Number(r.finalScore) : null,
      status: r.status,
    }));
  }

  async exportPerformanceReportPdf(query: QueryPmsDto, user: AuthUser): Promise<Buffer> {
    const tenantId = user.tenantId!;
    const reviews = await this.findAll(query, user);

    const pdfLines = [
      "%PDF-1.4",
      "1 0 obj",
      "<< /Type /Catalog /Pages 2 0 R >>",
      "endobj",
      "2 0 obj",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "endobj",
      "3 0 obj",
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>`,
      "endobj",
      "4 0 obj",
      `<< /Length 2000 >>`,
      "stream",
      "BT",
      "/F1 12 Tf",
      "72 712 Td",
      "(Performance Report) Tj",
      "0 -30 Td",
    ];

    for (const r of reviews) {
      pdfLines.push(`(Employee: ${r.employee.firstName} ${r.employee.lastName} | Code: ${r.employee.employeeCode}) Tj`);
      pdfLines.push("0 -20 Td");
      pdfLines.push(`(Cycle: ${r.appraisalCycle.name} | Status: ${r.status}) Tj`);
      pdfLines.push("0 -20 Td");
      pdfLines.push(`(Self Score: ${r.selfScore || "N/A"} | Manager Score: ${r.managerScore || "N/A"} | Final Score: ${r.finalScore || "N/A"}) Tj`);
      pdfLines.push("0 -30 Td");
    }

    pdfLines.push("ET");
    pdfLines.push("endstream");
    pdfLines.push("endobj");
    pdfLines.push("xref");
    pdfLines.push("0 5");
    pdfLines.push("0000000000 65535 f ");
    pdfLines.push("0000000009 00000 n ");
    pdfLines.push("0000000058 00000 n ");
    pdfLines.push("0000000115 00000 n ");
    pdfLines.push("0000000280 00000 n ");
    pdfLines.push("trailer");
    pdfLines.push("<< /Size 5 /Root 1 0 R >>");
    pdfLines.push("startxref");
    pdfLines.push("800");
    pdfLines.push("%%EOF");

    const content = pdfLines.join("\n");
    return Buffer.from(content, "utf-8");
  }
}
