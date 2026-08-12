/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AccountingService } from "../accounting/accounting.service";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import {
  Prisma,
  ExpenseClaimStatus,
  ExpenseApprovalStatus,
  EmployeeStatus,
  AccountType,
  AccountStatus,
} from "@amdox/database/generated";
import { CreateClaimDto } from "./dto/create-claim.dto";
import { ApproveClaimDto } from "./dto/approve-claim.dto";
import { ReimburseClaimDto } from "./dto/reimburse-claim.dto";
import { QueryClaimDto } from "./dto/query-claim.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { WorkflowService } from "../workflow/services/workflow.service";
import { NotificationType } from "../notifications/dto/query-notification.dto";

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly accountingService: AccountingService,
    private readonly transactionHelper: TransactionHelper,
    private readonly moduleRef: ModuleRef,
  ) {}

  async createClaim(dto: CreateClaimDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const claimDate = new Date(dto.claimDate);

    // Validate claim date is not in the future
    const now = new Date();
    if (claimDate > now) {
      throw new BadRequestException("Claim date cannot be in the future.");
    }

    // Title validation
    if (!dto.title || dto.title.trim() === "") {
      throw new BadRequestException("Claim title cannot be empty.");
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Validate employee belongs to tenant and is ACTIVE
      const employee = await tx.employee.findFirst({
        where: { id: dto.employeeId, tenantId, deletedAt: null },
      });
      if (!employee) {
        throw new NotFoundException(`Employee ${dto.employeeId} not found.`);
      }
      if (employee.status !== EmployeeStatus.ACTIVE) {
        throw new BadRequestException(
          "Employee must be ACTIVE to claim expenses.",
        );
      }

      let totalCalculated = new Prisma.Decimal(0);

      // Validate claim items
      for (const item of dto.items) {
        if (item.amount <= 0) {
          throw new BadRequestException(
            "Every item amount must be greater than zero.",
          );
        }
        totalCalculated = totalCalculated.add(new Prisma.Decimal(item.amount));

        // Validate GL Account
        const account = await tx.account.findFirst({
          where: { id: item.accountId, tenantId, deletedAt: null },
        });
        if (!account) {
          throw new NotFoundException(
            `GL Account ${item.accountId} not found.`,
          );
        }
        if (account.status !== AccountStatus.ACTIVE) {
          throw new BadRequestException(
            `GL Account ${account.name} is not ACTIVE.`,
          );
        }
        if (account.type !== AccountType.EXPENSE) {
          throw new BadRequestException(
            `GL Account ${account.name} is not of type EXPENSE.`,
          );
        }

        // Receipt media integration check
        if (item.receiptUrl) {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          let mediaFile = null;
          if (uuidRegex.test(item.receiptUrl)) {
            mediaFile = await tx.mediaFile.findFirst({
              where: { id: item.receiptUrl, tenantId, deletedAt: null },
            });
          } else {
            mediaFile = await tx.mediaFile.findFirst({
              where: {
                OR: [
                  { storagePath: item.receiptUrl },
                  { storedName: item.receiptUrl },
                ],
                tenantId,
                deletedAt: null,
              },
            });
          }

          if (!mediaFile) {
            throw new BadRequestException(
              `Receipt attachment ${item.receiptUrl} does not reference an existing active Media record.`,
            );
          }

          const mime = mediaFile.mimeType.toLowerCase();
          const validMimes = [
            "application/pdf",
            "image/jpeg",
            "image/jpg",
            "image/png",
          ];
          if (!validMimes.includes(mime)) {
            throw new BadRequestException(
              `Unsupported receipt format: ${mediaFile.mimeType}. Only PDF, JPG, and PNG are allowed.`,
            );
          }
        }
      }

      const claim = await tx.expenseClaim.create({
        data: {
          tenantId,
          employeeId: dto.employeeId,
          title: dto.title,
          claimDate,
          totalAmount: totalCalculated,
          status: ExpenseClaimStatus.DRAFT,
          approvalStage: 1,
          items: {
            create: dto.items.map((item) => ({
              tenantId,
              accountId: item.accountId,
              amount: new Prisma.Decimal(item.amount),
              description: item.description || null,
              receiptUrl: item.receiptUrl || null,
            })),
          },
        },
        include: {
          items: true,
          employee: true,
        },
      });

      await this.auditService.log(
        {
          action: "EXPENSE_CREATED",
          entity: "ExpenseClaim",
          entityId: claim.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(claim)),
        },
        tx,
      );

      return claim;
    });
  }

  async submitClaim(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const claim = await tx.expenseClaim.findFirst({
        where: { id, tenantId },
        include: { employee: true },
      });
      if (!claim) {
        throw new NotFoundException(`Expense claim ${id} not found.`);
      }
      if (claim.status !== ExpenseClaimStatus.DRAFT) {
        throw new BadRequestException("Only DRAFT claims can be submitted.");
      }

      const updated = await tx.expenseClaim.update({
        where: { id },
        data: {
          status: ExpenseClaimStatus.SUBMITTED,
          approvalStage: 1,
          version: claim.version + 1,
        },
        include: { employee: true },
      });

      await this.auditService.log(
        {
          action: "EXPENSE_SUBMITTED",
          entity: "ExpenseClaim",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: { id, status: ExpenseClaimStatus.SUBMITTED },
        },
        tx,
      );

      // Try to submit to workflow engine
      try {
        const workflowService = this.moduleRef.get(WorkflowService, {
          strict: false,
        });
        if (workflowService) {
          const def = await tx.workflowDefinition.findFirst({
            where: {
              tenantId,
              code: "EXPENSE_APPROVAL",
              isActive: true,
              deletedAt: null,
            },
          });
          if (def) {
            await (workflowService as any).submitInstance(
              {
                entityType: "ExpenseClaim",
                entityId: id,
                definitionCode: "EXPENSE_APPROVAL",
              },
              user,
            );
            return updated;
          }
        }
      } catch (err) {
        console.error(
          "Failed to automatically route expense claim to workflow engine:",
          err,
        );
      }

      // Notification
      if (claim.employee.reportingManagerId) {
        const manager = await tx.employee.findUnique({
          where: { id: claim.employee.reportingManagerId },
        });
        if (manager) {
          const managerUser = await tx.user.findFirst({
            where: { email: manager.email, tenantId },
          });
          if (managerUser) {
            await this.notificationsService.createInternal({
              userId: managerUser.id,
              tenantId,
              title: "Expense Claim Submitted",
              message: `Employee ${claim.employee.firstName} ${claim.employee.lastName} has submitted an expense claim: "${claim.title}" for your approval.`,
              type: NotificationType.INFO,
            });
          }
          console.log(
            `[EMAIL SENT] To: ${manager.email}, Subject: New Expense Claim Submitted, Body: Employee ${claim.employee.firstName} ${claim.employee.lastName} has submitted an expense claim "${claim.title}" for your approval.`,
          );
        }
      }

      return updated;
    });
  }

  async approveClaim(id: string, user: AuthUser, dto: ApproveClaimDto) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const claim = await tx.expenseClaim.findFirst({
        where: { id, tenantId },
        include: { employee: true },
      });
      if (!claim) {
        throw new NotFoundException(`Expense claim ${id} not found.`);
      }

      if (claim.status !== ExpenseClaimStatus.SUBMITTED) {
        throw new BadRequestException("Only SUBMITTED claims can be approved.");
      }

      const userRecord = await tx.user.findUnique({
        where: { id: user.id },
      });
      if (!userRecord) {
        throw new NotFoundException(`User record not found.`);
      }

      const approverEmployee = await tx.employee.findFirst({
        where: { email: userRecord.email, tenantId },
      });

      if (claim.approvalStage === 1) {
        // Manager Approval Stage
        if (
          !approverEmployee ||
          claim.employee.reportingManagerId !== approverEmployee.id
        ) {
          throw new ForbiddenException(
            "Only the reporting manager can perform first level of approval.",
          );
        }
        if (claim.employeeId === approverEmployee.id) {
          throw new ForbiddenException(
            "Employee cannot approve their own claim.",
          );
        }

        // Record Approval
        await tx.expenseClaimApproval.create({
          data: {
            tenantId,
            expenseClaimId: id,
            approverId: user.id,
            stage: 1,
            status: ExpenseApprovalStatus.APPROVED,
            comment: dto.comment || null,
          },
        });

        const updated = await tx.expenseClaim.update({
          where: { id },
          data: {
            approvalStage: 2,
            version: claim.version + 1,
          },
          include: { employee: true },
        });

        await this.auditService.log(
          {
            action: "EXPENSE_MANAGER_APPROVED",
            entity: "ExpenseClaim",
            entityId: id,
            tenantId,
            userId: user.id,
            newValues: { id, stage: 2 },
          },
          tx,
        );

        // Notify Finance
        const financeUsers = await tx.user.findMany({
          where: {
            tenantId,
            userRoles: {
              some: {
                role: {
                  rolePermissions: {
                    some: {
                      permission: {
                        name: "expense:approval:approve",
                      },
                    },
                  },
                },
              },
            },
          },
        });
        for (const fUser of financeUsers) {
          await this.notificationsService.createInternal({
            userId: fUser.id,
            tenantId,
            title: "Expense Claim Pending Finance Approval",
            message: `Expense claim "${claim.title}" has been approved by the manager and is pending finance approval.`,
            type: NotificationType.INFO,
          });
          console.log(
            `[EMAIL SENT] To: ${fUser.email}, Subject: Expense Claim Pending Finance Approval, Body: Expense claim "${claim.title}" is pending your approval.`,
          );
        }

        return updated;
      } else if (claim.approvalStage === 2) {
        // Finance Approval Stage
        if (
          !user.permissions ||
          !user.permissions.includes("expense:reimburse:write")
        ) {
          throw new ForbiddenException(
            "Only finance users can perform the second level of approval.",
          );
        }
        if (approverEmployee && claim.employeeId === approverEmployee.id) {
          throw new ForbiddenException(
            "Employee cannot approve their own claim.",
          );
        }

        await tx.expenseClaimApproval.create({
          data: {
            tenantId,
            expenseClaimId: id,
            approverId: user.id,
            stage: 2,
            status: ExpenseApprovalStatus.APPROVED,
            comment: dto.comment || null,
          },
        });

        const updated = await tx.expenseClaim.update({
          where: { id },
          data: {
            status: ExpenseClaimStatus.APPROVED,
            approvalStage: 3,
            version: claim.version + 1,
          },
          include: { employee: true },
        });

        await this.auditService.log(
          {
            action: "EXPENSE_FINANCE_APPROVED",
            entity: "ExpenseClaim",
            entityId: id,
            tenantId,
            userId: user.id,
            newValues: { id, status: ExpenseClaimStatus.APPROVED },
          },
          tx,
        );

        // Notify Employee
        const claimantUser = await tx.user.findFirst({
          where: { email: claim.employee.email, tenantId },
        });
        if (claimantUser) {
          await this.notificationsService.createInternal({
            userId: claimantUser.id,
            tenantId,
            title: "Expense Claim Approved",
            message: `Your expense claim "${claim.title}" has been approved.`,
            type: NotificationType.INFO,
          });
        }
        console.log(
          `[EMAIL SENT] To: ${claim.employee.email}, Subject: Expense Claim Approved, Body: Your expense claim "${claim.title}" has been approved.`,
        );

        return updated;
      } else {
        throw new BadRequestException("Invalid approval stage.");
      }
    });
  }

  async rejectClaim(id: string, user: AuthUser, dto: ApproveClaimDto) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const claim = await tx.expenseClaim.findFirst({
        where: { id, tenantId },
        include: { employee: true },
      });
      if (!claim) {
        throw new NotFoundException(`Expense claim ${id} not found.`);
      }

      if (claim.status !== ExpenseClaimStatus.SUBMITTED) {
        throw new BadRequestException("Only SUBMITTED claims can be rejected.");
      }

      const userRecord = await tx.user.findUnique({
        where: { id: user.id },
      });
      if (!userRecord) {
        throw new NotFoundException(`User record not found.`);
      }

      const approverEmployee = await tx.employee.findFirst({
        where: { email: userRecord.email, tenantId },
      });

      if (claim.approvalStage === 1) {
        if (
          !approverEmployee ||
          claim.employee.reportingManagerId !== approverEmployee.id
        ) {
          throw new ForbiddenException(
            "Only the reporting manager can reject in stage 1.",
          );
        }
      } else if (claim.approvalStage === 2) {
        if (
          !user.permissions ||
          !user.permissions.includes("expense:reimburse:write")
        ) {
          throw new ForbiddenException(
            "Only finance users can reject in stage 2.",
          );
        }
      }

      await tx.expenseClaimApproval.create({
        data: {
          tenantId,
          expenseClaimId: id,
          approverId: user.id,
          stage: claim.approvalStage,
          status: ExpenseApprovalStatus.REJECTED,
          comment: dto.comment || null,
        },
      });

      const updated = await tx.expenseClaim.update({
        where: { id },
        data: {
          status: ExpenseClaimStatus.REJECTED,
          version: claim.version + 1,
        },
        include: { employee: true },
      });

      await this.auditService.log(
        {
          action: "EXPENSE_REJECTED",
          entity: "ExpenseClaim",
          entityId: id,
          tenantId,
          userId: user.id,
          newValues: { id, status: ExpenseClaimStatus.REJECTED },
        },
        tx,
      );

      // Notify Employee
      const claimantUser = await tx.user.findFirst({
        where: { email: claim.employee.email, tenantId },
      });
      if (claimantUser) {
        await this.notificationsService.createInternal({
          userId: claimantUser.id,
          tenantId,
          title: "Expense Claim Rejected",
          message: `Your expense claim "${claim.title}" has been rejected. Comment: ${dto.comment || "No comment provided."}`,
          type: NotificationType.INFO,
        });
      }
      console.log(
        `[EMAIL SENT] To: ${claim.employee.email}, Subject: Expense Claim Rejected, Body: Your expense claim "${claim.title}" has been rejected.`,
      );

      return updated;
    });
  }

  async reimburseClaim(id: string, user: AuthUser, dto: ReimburseClaimDto) {
    const tenantId = user.tenantId!;

    // Perform reimbursement in sequence or inside accounting transaction
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id, tenantId },
      include: {
        employee: true,
        items: true,
      },
    });
    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found.`);
    }

    if (claim.version !== dto.expectedVersion) {
      throw new ConflictException("Optimistic concurrency lock failed.");
    }

    if (claim.status === ExpenseClaimStatus.REIMBURSED) {
      throw new BadRequestException("Expense claim is already reimbursed.");
    }

    if (claim.status !== ExpenseClaimStatus.APPROVED) {
      throw new BadRequestException("Only APPROVED claims can be reimbursed.");
    }

    // Verify bank account
    const bankAccount = await this.prisma.account.findFirst({
      where: { id: dto.bankAccountId, tenantId, deletedAt: null },
    });
    if (!bankAccount) {
      throw new NotFoundException("Selected Bank/Cash Account not found.");
    }
    if (bankAccount.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(
        `Bank account ${bankAccount.name} is inactive.`,
      );
    }
    if (bankAccount.type !== AccountType.ASSET) {
      throw new BadRequestException(
        `Bank account ${bankAccount.name} must be of type ASSET.`,
      );
    }

    // Create journal entries
    const lines = claim.items.map((item) => ({
      accountId: item.accountId,
      debit: item.amount.toNumber(),
      credit: 0,
      description:
        item.description || `Expense claim item reimbursement: ${claim.title}`,
    }));

    // Credit selected bank account
    lines.push({
      accountId: dto.bankAccountId,
      debit: 0,
      credit: claim.totalAmount.toNumber(),
      description: `Reimbursement for claim: ${claim.title}`,
    });

    // Create Draft Journal Entry
    const journalEntry = await this.accountingService.createJournalEntry(
      {
        postingDate: new Date().toISOString(),
        description: `Expense Reimbursement - ${claim.title}`,
        lines,
      },
      user,
    );

    // Post Journal Entry (Updates ledger and balances)
    await this.accountingService.postJournalEntry(
      journalEntry.id,
      { expectedVersion: journalEntry.version },
      user,
    );

    // Update claim status to REIMBURSED
    const updated = await this.prisma.expenseClaim.update({
      where: { id },
      data: {
        status: ExpenseClaimStatus.REIMBURSED,
        version: claim.version + 1,
      },
      include: { employee: true },
    });

    await this.auditService.log({
      action: "EXPENSE_REIMBURSED",
      entity: "ExpenseClaim",
      entityId: id,
      tenantId,
      userId: user.id,
      newValues: { id, status: ExpenseClaimStatus.REIMBURSED },
    });

    // Notify Employee
    const claimantUser = await this.prisma.user.findFirst({
      where: { email: claim.employee.email, tenantId },
    });
    if (claimantUser) {
      await this.notificationsService.createInternal({
        userId: claimantUser.id,
        tenantId,
        title: "Expense Claim Reimbursed",
        message: `Your expense claim "${claim.title}" has been reimbursed.`,
        type: NotificationType.INFO,
      });
    }
    console.log(
      `[EMAIL SENT] To: ${claim.employee.email}, Subject: Expense Claim Reimbursed, Body: Your expense claim "${claim.title}" has been reimbursed.`,
    );

    return updated;
  }

  async findAll(query: QueryClaimDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const where: Prisma.ExpenseClaimWhereInput = { tenantId };

    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.status) {
      where.status = query.status;
    }

    return this.prisma.expenseClaim.findMany({
      where,
      include: {
        employee: true,
        items: {
          include: {
            account: true,
          },
        },
        approvals: {
          include: {
            approver: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const claim = await this.prisma.expenseClaim.findFirst({
      where: { id, tenantId },
      include: {
        employee: true,
        items: {
          include: {
            account: true,
          },
        },
        approvals: {
          include: {
            approver: true,
          },
        },
      },
    });

    if (!claim) {
      throw new NotFoundException(`Expense claim ${id} not found.`);
    }
    return claim;
  }

  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;

    const statusCounts = await this.prisma.expenseClaim.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    let totalReimbursedAmount = new Prisma.Decimal(0);
    let pendingCount = 0;
    let approvedCount = 0;
    let reimbursedCount = 0;
    let rejectedCount = 0;

    for (const sc of statusCounts) {
      if (sc.status === ExpenseClaimStatus.REIMBURSED) {
        reimbursedCount = sc._count.id;
        if (sc._sum.totalAmount) {
          totalReimbursedAmount = totalReimbursedAmount.add(
            sc._sum.totalAmount,
          );
        }
      } else if (sc.status === ExpenseClaimStatus.SUBMITTED) {
        pendingCount = sc._count.id;
      } else if (sc.status === ExpenseClaimStatus.APPROVED) {
        approvedCount = sc._count.id;
      } else if (sc.status === ExpenseClaimStatus.REJECTED) {
        rejectedCount = sc._count.id;
      }
    }

    return {
      totalReimbursedAmount,
      pendingCount,
      approvedCount,
      reimbursedCount,
      rejectedCount,
    };
  }

  async onWorkflowComplete(
    tx: PrismaTx,
    tenantId: string,
    entityId: string,
    status: string,
    user: AuthUser,
  ) {
    const claim = await tx.expenseClaim.findFirst({
      where: { id: entityId, tenantId },
      include: { employee: true },
    });
    if (!claim) return;

    const finalStatus =
      status === "APPROVED"
        ? ExpenseClaimStatus.APPROVED
        : ExpenseClaimStatus.REJECTED;

    await tx.expenseClaim.update({
      where: { id: entityId },
      data: {
        status: finalStatus,
        approvalStage: status === "APPROVED" ? 3 : claim.approvalStage,
        version: claim.version + 1,
      },
    });

    await tx.auditLog.create({
      data: {
        action:
          status === "APPROVED"
            ? "EXPENSE_FINANCE_APPROVED"
            : "EXPENSE_CLAIM_REJECTED",
        entity: "ExpenseClaim",
        entityId,
        tenantId,
        userId: user.id,
        newValues: { status: finalStatus },
      },
    });
  }
}
