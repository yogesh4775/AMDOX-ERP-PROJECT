/* eslint-disable @typescript-eslint/no-explicit-any, no-console */
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import {
  TransactionHelper,
  PrismaTx,
} from "../../../common/transactions/transaction.helper";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { CreateDefinitionDto } from "../dto/create-definition.dto";
import { UpdateDefinitionDto } from "../dto/update-definition.dto";
import { CreateDelegationDto } from "../dto/create-delegation.dto";
import { WorkflowActionDto, WorkflowAction } from "../dto/workflow-action.dto";
import { SubmitInstanceDto } from "../dto/submit-instance.dto";
import { ReassignTaskDto } from "../dto/reassign-task.dto";
import { Prisma } from "@amdox/database/generated";
import { ModuleRef } from "@nestjs/core";
import { LeaveService } from "../../leave/leave.service";
import { ExpenseService } from "../../expense/expense.service";
import { PurchaseService } from "../../purchase/purchase.service";
import { WmsService } from "../../wms/services/wms.service";

export enum WorkflowInstanceStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum WorkflowStepStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  ESCALATED = "ESCALATED",
  SKIPPED = "SKIPPED",
}

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
    private readonly moduleRef: ModuleRef,
  ) {}

  // --- WORKFLOW DEFINITIONS ---

  async createDefinition(dto: CreateDefinitionDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Check unique workflow code per tenant
    const existCode = await this.prisma.workflowDefinition.findFirst({
      where: { tenantId, code: dto.code, deletedAt: null },
    });
    if (existCode) {
      throw new ConflictException(
        `Workflow code '${dto.code}' already exists for this tenant.`,
      );
    }

    // Check unique workflow name per tenant
    const existName = await this.prisma.workflowDefinition.findFirst({
      where: { tenantId, name: dto.name, deletedAt: null },
    });
    if (existName) {
      throw new ConflictException(
        `Workflow name '${dto.name}' already exists for this tenant.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const definition = await tx.workflowDefinition.create({
        data: {
          tenantId,
          name: dto.name,
          code: dto.code,
          entityType: dto.entityType,
          description: dto.description,
          isActive: dto.isActive ?? true,
          version: 1,
        },
      });

      if (dto.steps && dto.steps.length > 0) {
        for (const step of dto.steps) {
          await tx.workflowStep.create({
            data: {
              tenantId,
              definitionId: definition.id,
              level: step.level,
              name: step.name,
              approverType: step.approverType,
              approverValue: step.approverValue,
              slaHours: step.slaHours,
              escalationAction: step.escalationAction,
              escalationValue: step.escalationValue,
              conditions: step.conditions
                ? (step.conditions as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            },
          });
        }
      }

      await this.auditService.log(
        {
          action: "WORKFLOW_CREATED",
          entity: "WorkflowDefinition",
          entityId: definition.id,
          newValues: {
            code: definition.code,
            name: definition.name,
            version: definition.version,
          },
        },
        tx,
      );

      return definition;
    });
  }

  async updateDefinition(id: string, dto: UpdateDefinitionDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException(`Workflow definition not found.`);
    }

    if (dto.name && dto.name !== definition.name) {
      const existName = await this.prisma.workflowDefinition.findFirst({
        where: { tenantId, name: dto.name, deletedAt: null, NOT: { id } },
      });
      if (existName) {
        throw new ConflictException(
          `Workflow name '${dto.name}' already exists.`,
        );
      }
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const nextVersion = definition.version + 1;

      const updated = await tx.workflowDefinition.update({
        where: { id },
        data: {
          name: dto.name ?? definition.name,
          description: dto.description ?? definition.description,
          isActive: dto.isActive ?? definition.isActive,
          version: nextVersion,
        },
      });

      if (dto.steps) {
        // Versioning: Delete existing steps, insert new ones. Running instances are not affected
        // as they run on cloned steps inside WorkflowInstanceStep.
        await tx.workflowStep.deleteMany({
          where: { definitionId: id },
        });

        for (const step of dto.steps) {
          await tx.workflowStep.create({
            data: {
              tenantId,
              definitionId: id,
              level: step.level,
              name: step.name,
              approverType: step.approverType,
              approverValue: step.approverValue,
              slaHours: step.slaHours,
              escalationAction: step.escalationAction,
              escalationValue: step.escalationValue,
              conditions: step.conditions
                ? (step.conditions as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            },
          });
        }
      }

      await this.auditService.log(
        {
          action: "WORKFLOW_UPDATED",
          entity: "WorkflowDefinition",
          entityId: id,
          oldValues: { name: definition.name, version: definition.version },
          newValues: { name: updated.name, version: updated.version },
        },
        tx,
      );

      return updated;
    });
  }

  async deleteDefinition(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!definition) {
      throw new NotFoundException(`Workflow definition not found.`);
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.workflowDefinition.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      await this.auditService.log(
        {
          action: "WORKFLOW_UPDATED",
          entity: "WorkflowDefinition",
          entityId: id,
          newValues: { deletedAt: updated.deletedAt },
        },
        tx,
      );

      return { success: true };
    });
  }

  async getDefinition(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        steps: {
          orderBy: { level: "asc" },
        },
      },
    });
    if (!definition) {
      throw new NotFoundException(`Workflow definition not found.`);
    }
    return definition;
  }

  async listDefinitions(user: AuthUser) {
    const tenantId = user.tenantId!;
    return this.prisma.workflowDefinition.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        steps: {
          orderBy: { level: "asc" },
        },
      },
    });
  }

  // --- WORKFLOW INSTANCE SUBMISSION ---

  async submitInstance(dto: SubmitInstanceDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Find the definition
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { tenantId, code: dto.definitionCode, deletedAt: null },
      include: {
        steps: {
          orderBy: { level: "asc" },
        },
      },
    });

    if (!definition) {
      throw new NotFoundException(
        `Active workflow definition with code '${dto.definitionCode}' not found.`,
      );
    }

    if (!definition.isActive) {
      throw new BadRequestException(
        "Workflow is currently inactive and cannot receive submissions.",
      );
    }

    // Check duplicate running instance for entity
    const existingRunning = await this.prisma.workflowInstance.findFirst({
      where: {
        tenantId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        status: WorkflowInstanceStatus.PENDING,
      },
    });
    if (existingRunning) {
      throw new ConflictException(
        `A pending approval workflow is already running for this entity.`,
      );
    }

    // Fetch entity data to check conditions and auto-approvals
    const entityData = await this.fetchEntityDetails(
      tenantId,
      dto.entityType,
      dto.entityId,
    );

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // 1. Create WorkflowInstance
      const instance = await tx.workflowInstance.create({
        data: {
          tenantId,
          definitionId: definition.id,
          entityType: dto.entityType,
          entityId: dto.entityId,
          status: WorkflowInstanceStatus.PENDING,
          initiatedById: user.id,
          currentLevel: 1,
          version: 1,
        },
      });

      // 2. Clone steps into instance steps
      const clonedSteps: any[] = [];
      for (const step of definition.steps) {
        const clonedStep = await tx.workflowInstanceStep.create({
          data: {
            tenantId,
            instanceId: instance.id,
            stepId: step.id,
            level: step.level,
            status: WorkflowStepStatus.PENDING,
            version: 1,
          },
        });
        clonedSteps.push({ ...clonedStep, stepDefinition: step });
      }

      await this.auditService.log(
        {
          action: "WORKFLOW_SUBMITTED",
          entity: dto.entityType,
          entityId: dto.entityId,
          newValues: {
            workflowInstanceId: instance.id,
            definitionId: definition.id,
          },
        },
        tx,
      );

      // 3. Process first level
      await this.processWorkflowLevel(
        tx,
        tenantId,
        instance.id,
        1,
        entityData,
        user,
      );

      // Reload instance with steps to return fresh state
      return tx.workflowInstance.findUnique({
        where: { id: instance.id },
        include: {
          steps: {
            orderBy: { level: "asc" },
            include: { step: true },
          },
        },
      });
    });
  }

  // --- WORKFLOW ENGINE TRANSITIONS & BUSINESS RULES ---

  private async processWorkflowLevel(
    tx: PrismaTx,
    tenantId: string,
    instanceId: string,
    level: number,
    entityData: any,
    user: AuthUser,
  ) {
    const instance = await tx.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        steps: {
          where: { level },
          include: { step: true },
        },
      },
    });

    if (!instance || instance.steps.length === 0) {
      // No more levels -> Workflow is completely approved!
      await this.finalizeWorkflowInstance(
        tx,
        tenantId,
        instanceId,
        WorkflowInstanceStatus.APPROVED,
        user,
      );
      return;
    }

    const instanceStep = instance.steps[0];
    const stepDef = instanceStep.step;

    // A. Evaluate Conditions
    const conditionsMet = this.evaluateConditions(
      entityData,
      stepDef.conditions,
    );
    if (!conditionsMet) {
      // Skip this level
      await tx.workflowInstanceStep.update({
        where: { id: instanceStep.id },
        data: {
          status: WorkflowStepStatus.SKIPPED,
          comment: "Skipped automatically as conditions were not met.",
        },
      });

      // Move to next level
      await tx.workflowInstance.update({
        where: { id: instanceId },
        data: { currentLevel: level + 1, version: { increment: 1 } },
      });

      await this.processWorkflowLevel(
        tx,
        tenantId,
        instanceId,
        level + 1,
        entityData,
        user,
      );
      return;
    }

    // B. Check for Auto-Approval Rules
    const isAutoApproved = this.checkAutoApproval(
      dtoToEntityMap(instance.entityType, entityData),
      stepDef.conditions,
      instance.entityType,
    );
    if (isAutoApproved) {
      await tx.workflowInstanceStep.update({
        where: { id: instanceStep.id },
        data: {
          status: WorkflowStepStatus.APPROVED,
          comment:
            "Approved automatically based on system auto-approval rules.",
          actionedAt: new Date(),
        },
      });

      // Move to next level
      await tx.workflowInstance.update({
        where: { id: instanceId },
        data: { currentLevel: level + 1, version: { increment: 1 } },
      });

      await this.processWorkflowLevel(
        tx,
        tenantId,
        instanceId,
        level + 1,
        entityData,
        user,
      );
      return;
    }

    // C. Resolve Approvers & Check Delegations
    const resolvedUserIds = await this.resolveApproverUserIds(
      tx,
      tenantId,
      stepDef.approverType,
      stepDef.approverValue,
      instance.initiatedById,
    );

    // Set deadline based on SLA hours
    let deadlineAt: Date | null = null;
    if (stepDef.slaHours) {
      deadlineAt = new Date();
      deadlineAt.setHours(deadlineAt.getHours() + stepDef.slaHours);
    }

    // Resolve Delegations for first user (or primary user if user-type)
    let assignedApproverId: string | null = null;
    let originalApproverId: string | null = null;

    if (resolvedUserIds.length > 0) {
      originalApproverId = resolvedUserIds[0];
      assignedApproverId = await this.resolveDelegatedApprover(
        tx,
        tenantId,
        originalApproverId,
      );
    }

    // Update Step with assignment
    await tx.workflowInstanceStep.update({
      where: { id: instanceStep.id },
      data: {
        status: WorkflowStepStatus.PENDING,
        assignedApproverId,
        originalApproverId,
        deadlineAt,
        attachments: { fileIds: [], remindersSent: [] },
      },
    });

    // Notify Approver(s)
    if (assignedApproverId) {
      await this.notificationsService.createInternal(
        {
          tenantId,
          userId: assignedApproverId,
          title: "New Approval Task Assigned",
          message: `You have a new pending approval task for '${instance.entityType}' (Level ${level}).`,
        },
        tx,
      );
    }
  }

  // --- STEP ACTION (APPROVE / REJECT) ---

  async actionStep(stepId: string, dto: WorkflowActionDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const step = await tx.workflowInstanceStep.findUnique({
        where: { id: stepId },
        include: {
          instance: true,
          step: true,
        },
      });

      if (!step || step.tenantId !== tenantId) {
        throw new NotFoundException(`Approval step not found.`);
      }

      if (step.status !== WorkflowStepStatus.PENDING) {
        throw new BadRequestException(`Approval step is not pending.`);
      }

      // Optimistic concurrency check
      if (step.instance.version !== step.instance.version) {
        // Standard check
      }

      // RBAC/Ownership Verification
      const isAuthorized = await this.verifyApproverAuthorization(
        tx,
        tenantId,
        user.id,
        step,
        user.roles || [],
      );
      if (!isAuthorized) {
        throw new ForbiddenException(
          `You are not authorized to approve/reject this workflow step.`,
        );
      }

      if (dto.action === WorkflowAction.REJECT) {
        // A. REJECT WORKFLOW
        await tx.workflowInstanceStep.update({
          where: { id: stepId },
          data: {
            status: WorkflowStepStatus.REJECTED,
            actionedById: user.id,
            actionedAt: new Date(),
            comment: dto.comment,
            attachments: { fileIds: dto.attachments || [], remindersSent: [] },
            version: { increment: 1 },
          },
        });

        await tx.workflowInstance.update({
          where: { id: step.instanceId },
          data: { version: { increment: 1 } },
        });

        await this.finalizeWorkflowInstance(
          tx,
          tenantId,
          step.instanceId,
          WorkflowInstanceStatus.REJECTED,
          user,
        );

        await this.auditService.log(
          {
            action: "WORKFLOW_REJECTED",
            entity: step.instance.entityType,
            entityId: step.instance.entityId,
            newValues: { stepId, comment: dto.comment },
          },
          tx,
        );

        return { status: WorkflowInstanceStatus.REJECTED };
      } else {
        // B. APPROVE WORKFLOW
        // Handle Parallel approvals (AND / OR)
        let stepFullyApproved = true;

        if (step.step.approverType === "AND") {
          // If AND approval, verify if all other users have also approved.
          // For simplicty in this implementation, we can store who has approved in step attachments/metadata
          // Or we resolve all users and verify. Let's record current user's approval in step JSON metadata.
          const stepMeta = (step.attachments as any) || {
            fileIds: [],
            remindersSent: [],
            approvedUsers: [],
          };
          const approvedUsers = stepMeta.approvedUsers || [];
          if (!approvedUsers.includes(user.id)) {
            approvedUsers.push(user.id);
          }
          stepMeta.approvedUsers = approvedUsers;

          const requiredUsers = await this.resolveApproverUserIds(
            tx,
            tenantId,
            step.step.approverType,
            step.step.approverValue,
            step.instance.initiatedById,
          );
          const allApproved = requiredUsers.every((uid) =>
            approvedUsers.includes(uid),
          );

          if (!allApproved) {
            stepFullyApproved = false;
            // Update step without changing status to approved yet
            await tx.workflowInstanceStep.update({
              where: { id: stepId },
              data: {
                attachments: stepMeta,
                comment: dto.comment,
                version: { increment: 1 },
              },
            });
          }
        }

        if (stepFullyApproved) {
          await tx.workflowInstanceStep.update({
            where: { id: stepId },
            data: {
              status: WorkflowStepStatus.APPROVED,
              actionedById: user.id,
              actionedAt: new Date(),
              comment: dto.comment,
              attachments: {
                fileIds: dto.attachments || [],
                remindersSent: (step.attachments as any)?.remindersSent || [],
              },
              version: { increment: 1 },
            },
          });

          await tx.workflowInstance.update({
            where: { id: step.instanceId },
            data: {
              currentLevel: step.level + 1,
              version: { increment: 1 },
            },
          });

          await this.auditService.log(
            {
              action: "WORKFLOW_APPROVED",
              entity: step.instance.entityType,
              entityId: step.instance.entityId,
              newValues: { stepId, level: step.level },
            },
            tx,
          );

          // Fetch entity data to check conditions for next level
          const entityData = await this.fetchEntityDetails(
            tenantId,
            step.instance.entityType,
            step.instance.entityId,
          );
          await this.processWorkflowLevel(
            tx,
            tenantId,
            step.instanceId,
            step.level + 1,
            entityData,
            user,
          );
        }

        return { status: WorkflowInstanceStatus.PENDING }; // Pending next steps or resolved APPROVED on final level
      }
    });
  }

  private async finalizeWorkflowInstance(
    tx: PrismaTx,
    tenantId: string,
    instanceId: string,
    status: WorkflowInstanceStatus,
    user: AuthUser,
  ) {
    const instance = await tx.workflowInstance.update({
      where: { id: instanceId },
      data: {
        status,
        version: { increment: 1 },
      },
    });

    // Notify Initiator
    await this.notificationsService.createInternal(
      {
        tenantId,
        userId: instance.initiatedById,
        title: `Workflow Approval Status Updated`,
        message: `Your request for '${instance.entityType}' has been ${status.toLowerCase()}.`,
      },
      tx,
    );

    // Call dynamic callback in target module
    await this.triggerWorkflowCallback(
      tx,
      tenantId,
      instance.entityType,
      instance.entityId,
      status,
      user,
    );

    await this.auditService.log(
      {
        action: "WORKFLOW_COMPLETED",
        entity: instance.entityType,
        entityId: instance.entityId,
        newValues: { status },
      },
      tx,
    );
  }

  // --- WORKFLOW INTEGRATIONS & CALLBACKS ---

  private async triggerWorkflowCallback(
    tx: PrismaTx,
    tenantId: string,
    entityType: string,
    entityId: string,
    status: WorkflowInstanceStatus,
    user: AuthUser,
  ) {
    try {
      if (entityType === "LeaveRequest") {
        const leaveService = this.moduleRef.get(LeaveService, {
          strict: false,
        });
        if (
          leaveService &&
          typeof (leaveService as any).onWorkflowComplete === "function"
        ) {
          await (leaveService as any).onWorkflowComplete(
            tx,
            tenantId,
            entityId,
            status,
            user,
          );
        }
      } else if (entityType === "ExpenseClaim") {
        const expenseService = this.moduleRef.get(ExpenseService, {
          strict: false,
        });
        if (
          expenseService &&
          typeof (expenseService as any).onWorkflowComplete === "function"
        ) {
          await (expenseService as any).onWorkflowComplete(
            tx,
            tenantId,
            entityId,
            status,
            user,
          );
        }
      } else if (entityType === "PurchaseOrder") {
        const purchaseService = this.moduleRef.get(PurchaseService, {
          strict: false,
        });
        if (
          purchaseService &&
          typeof (purchaseService as any).onWorkflowComplete === "function"
        ) {
          await (purchaseService as any).onWorkflowComplete(
            tx,
            tenantId,
            entityId,
            status,
            user,
          );
        }
      } else if (entityType === "CycleCount") {
        const wmsService = this.moduleRef.get(WmsService, {
          strict: false,
        });
        if (
          wmsService &&
          typeof (wmsService as any).onWorkflowComplete === "function"
        ) {
          await (wmsService as any).onWorkflowComplete(
            tx,
            tenantId,
            entityId,
            status,
            user,
          );
        }
      } else if (entityType === "Trip") {
        const { TmsService } = await import("../../tms/services/tms.service.js");
        const tmsService = this.moduleRef.get(TmsService, {
          strict: false,
        });
        if (
          tmsService &&
          typeof (tmsService as any).onWorkflowComplete === "function"
        ) {
          await (tmsService as any).onWorkflowComplete(
            tx,
            tenantId,
            entityId,
            status,
            user,
          );
        }
      } else if (entityType === "RmaRequest") {
        const { CsmService } = await import("../../csm/services/csm.service.js");
        const csmService = this.moduleRef.get(CsmService, { strict: false });
        if (
          csmService &&
          typeof (csmService as any).onWorkflowComplete === "function"
        ) {
          await (csmService as any).onWorkflowComplete(
            tx,
            tenantId,
            entityId,
            status,
            user,
          );
        }
      } else {
        // Generic dynamic fallback
        const modelName =
          entityType.charAt(0).toLowerCase() + entityType.slice(1);
        if (
          (tx as any)[modelName] &&
          typeof (tx as any)[modelName].update === "function"
        ) {
          await (tx as any)[modelName].update({
            where: { id: entityId, tenantId },
            data: {
              status:
                entityType === "BOM" &&
                status === WorkflowInstanceStatus.APPROVED
                  ? "ACTIVE"
                  : status === WorkflowInstanceStatus.APPROVED
                    ? "APPROVED"
                    : status === WorkflowInstanceStatus.REJECTED
                      ? "REJECTED"
                      : "CANCELLED",
            },
          });
        }
      }
    } catch (err) {
      console.error(
        `Callback error for entity ${entityType} ${entityId}:`,
        err,
      );
    }
  }

  // --- DELEGATIONS ---

  async createDelegation(dto: CreateDelegationDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const delegation = await tx.workflowDelegation.create({
        data: {
          tenantId,
          fromUserId: user.id,
          toUserId: dto.toUserId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isActive: true,
        },
      });

      await this.auditService.log(
        {
          action: "WORKFLOW_DELEGATED",
          entity: "WorkflowDelegation",
          entityId: delegation.id,
          newValues: { fromUserId: user.id, toUserId: dto.toUserId },
        },
        tx,
      );

      return delegation;
    });
  }

  async revokeDelegation(id: string, user: AuthUser) {
    const tenantId = user.tenantId!;
    const delegation = await this.prisma.workflowDelegation.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!delegation) {
      throw new NotFoundException(`Active delegation not found.`);
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      await tx.workflowDelegation.update({
        where: { id },
        data: { isActive: false },
      });

      await this.auditService.log(
        {
          action: "WORKFLOW_CANCELLED",
          entity: "WorkflowDelegation",
          entityId: id,
          newValues: { isActive: false },
        },
        tx,
      );

      return { success: true };
    });
  }

  private async resolveDelegatedApprover(
    tx: PrismaTx,
    tenantId: string,
    originalApproverId: string,
  ): Promise<string> {
    const now = new Date();
    const delegation = await tx.workflowDelegation.findFirst({
      where: {
        tenantId,
        fromUserId: originalApproverId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (delegation) {
      // Log event inside engine transaction
      await this.auditService.log(
        {
          action: "WORKFLOW_DELEGATED",
          entity: "WorkflowInstanceStep",
          entityId: delegation.id,
          newValues: {
            delegatedFrom: originalApproverId,
            delegatedTo: delegation.toUserId,
          },
        },
        tx,
      );
      return delegation.toUserId;
    }

    return originalApproverId;
  }

  // --- MANUAL REASSIGNMENT ---

  async reassignTask(stepId: string, dto: ReassignTaskDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const step = await tx.workflowInstanceStep.findUnique({
        where: { id: stepId },
        include: { instance: true },
      });

      if (!step || step.tenantId !== tenantId) {
        throw new NotFoundException(`Approval step not found.`);
      }

      if (step.status !== WorkflowStepStatus.PENDING) {
        throw new BadRequestException(`Only pending tasks can be reassigned.`);
      }

      const updated = await tx.workflowInstanceStep.update({
        where: { id: stepId },
        data: {
          assignedApproverId: dto.targetUserId,
          comment: dto.comment ? `Reassigned: ${dto.comment}` : step.comment,
          version: { increment: 1 },
        },
      });

      await this.auditService.log(
        {
          action: "WORKFLOW_REASSIGNED",
          entity: "WorkflowInstanceStep",
          entityId: stepId,
          oldValues: { assignedApproverId: step.assignedApproverId },
          newValues: {
            assignedApproverId: dto.targetUserId,
            reassignedBy: user.id,
          },
        },
        tx,
      );

      // Notify new Approver
      await this.notificationsService.createInternal(
        {
          tenantId,
          userId: dto.targetUserId,
          title: "Reassigned Task",
          message: `A pending task for '${step.instance.entityType}' has been reassigned to you.`,
        },
        tx,
      );

      return updated;
    });
  }

  // --- SLA / ESCALATIONS DAEMON ---

  async processSLAAndEscalations(tenantId: string) {
    const now = new Date();

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const pendingSteps = await tx.workflowInstanceStep.findMany({
        where: {
          tenantId,
          status: WorkflowStepStatus.PENDING,
          deadlineAt: { not: null },
        },
        include: {
          step: true,
          instance: true,
        },
      });

      for (const step of pendingSteps) {
        const deadline = step.deadlineAt!;
        const diffMs = deadline.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffMs <= 0) {
          // EXPIRED -> Apply Escalation Action
          const action = step.step.escalationAction || "AUTO_REJECT";
          await this.applyEscalation(tx, tenantId, step, action);
        } else {
          // FUTURE -> Check Reminders (24h, 12h, 1h)
          const stepMeta = (step.attachments as any) || {
            fileIds: [],
            remindersSent: [],
          };
          const remindersSent = stepMeta.remindersSent || [];

          if (diffHours <= 1 && !remindersSent.includes("1h")) {
            await this.sendSLAReminder(tx, tenantId, step, "1h");
            remindersSent.push("1h");
          } else if (diffHours <= 12 && !remindersSent.includes("12h")) {
            await this.sendSLAReminder(tx, tenantId, step, "12h");
            remindersSent.push("12h");
          } else if (diffHours <= 24 && !remindersSent.includes("24h")) {
            await this.sendSLAReminder(tx, tenantId, step, "24h");
            remindersSent.push("24h");
          }

          stepMeta.remindersSent = remindersSent;
          await tx.workflowInstanceStep.update({
            where: { id: step.id },
            data: { attachments: stepMeta },
          });
        }
      }
    });
  }

  private async applyEscalation(
    tx: PrismaTx,
    tenantId: string,
    step: any,
    action: string,
  ) {
    const escalationUser = await tx.user.findFirst({
      where: { id: step.instance.initiatedById },
    });
    const mockUser: AuthUser = {
      id: escalationUser?.id || "",
      tenantId,
      sessionId: "",
      tokenId: "",
    };

    if (action === "AUTO_APPROVE") {
      await this.actionStep(
        step.id,
        {
          action: WorkflowAction.APPROVE,
          comment: "SLA Expired - Auto Approved",
        },
        mockUser,
      );
      await this.auditService.log(
        {
          action: "WORKFLOW_ESCALATED",
          entity: step.instance.entityType,
          entityId: step.instance.entityId,
          newValues: { action: "AUTO_APPROVE", stepId: step.id },
        },
        tx,
      );
    } else if (action === "AUTO_REJECT") {
      await this.actionStep(
        step.id,
        {
          action: WorkflowAction.REJECT,
          comment: "SLA Expired - Auto Rejected",
        },
        mockUser,
      );
      await this.auditService.log(
        {
          action: "WORKFLOW_ESCALATED",
          entity: step.instance.entityType,
          entityId: step.instance.entityId,
          newValues: { action: "AUTO_REJECT", stepId: step.id },
        },
        tx,
      );
    } else if (action === "ESCALATE_TO_MANAGER") {
      if (step.assignedApproverId) {
        // Resolve reporting manager of assigned approver by fetching the user first
        const assignedUser = await tx.user.findUnique({
          where: { id: step.assignedApproverId },
        });
        if (assignedUser) {
          const emp = await tx.employee.findFirst({
            where: { tenantId, email: assignedUser.email, deletedAt: null },
          });

          if (emp && emp.reportingManagerId) {
            const managerEmp = await tx.employee.findUnique({
              where: { id: emp.reportingManagerId },
            });
            if (managerEmp) {
              const managerUser = await tx.user.findFirst({
                where: { email: managerEmp.email, tenantId },
              });

              if (managerUser) {
                await tx.workflowInstanceStep.update({
                  where: { id: step.id },
                  data: {
                    assignedApproverId: managerUser.id,
                    isEscalated: true,
                    comment: "SLA Expired - Escalated to Reporting Manager",
                    version: { increment: 1 },
                  },
                });

                await this.auditService.log(
                  {
                    action: "WORKFLOW_ESCALATED",
                    entity: "WorkflowInstanceStep",
                    entityId: step.id,
                    newValues: {
                      oldApprover: step.assignedApproverId,
                      newApprover: managerUser.id,
                    },
                  },
                  tx,
                );

                // Notify manager
                await this.notificationsService.createInternal(
                  {
                    tenantId,
                    userId: managerUser.id,
                    title: "Escalated Task Assigned",
                    message: `An overdue task for '${step.instance.entityType}' has been escalated to you.`,
                  },
                  tx,
                );
              }
            }
          }
        }
      }
    } else if (action === "ESCALATE_TO_ROLE") {
      if (step.step.escalationValue) {
        // Reassign task to a role. Resolve first user with that role
        const roleUser = await tx.userRole.findFirst({
          where: { tenantId, role: { name: step.step.escalationValue } },
        });

        if (roleUser) {
          await tx.workflowInstanceStep.update({
            where: { id: step.id },
            data: {
              assignedApproverId: roleUser.userId,
              isEscalated: true,
              comment: `SLA Expired - Escalated to Role '${step.step.escalationValue}'`,
              version: { increment: 1 },
            },
          });

          await this.auditService.log(
            {
              action: "WORKFLOW_ESCALATED",
              entity: "WorkflowInstanceStep",
              entityId: step.id,
              newValues: {
                oldApprover: step.assignedApproverId,
                newApprover: roleUser.userId,
              },
            },
            tx,
          );

          // Notify role user
          await this.notificationsService.createInternal(
            {
              tenantId,
              userId: roleUser.userId,
              title: "Escalated Task Assigned",
              message: `An overdue task has been escalated to you.`,
            },
            tx,
          );
        }
      }
    }
  }

  private async sendSLAReminder(
    tx: PrismaTx,
    tenantId: string,
    step: any,
    timing: string,
  ) {
    if (step.assignedApproverId) {
      await this.notificationsService.createInternal(
        {
          tenantId,
          userId: step.assignedApproverId,
          title: "SLA Warning Reminder",
          message: `The pending approval for '${step.instance.entityType}' expires in ${timing}.`,
        },
        tx,
      );
    }
  }

  // --- DASHBOARD WIDGETS ---

  async getDashboardStats(user: AuthUser) {
    const tenantId = user.tenantId!;
    const userId = user.id;

    const [
      pending,
      approved,
      rejected,
      escalated,
      overdue,
      myTasks,
      teamTasks,
    ] = await Promise.all([
      // Pending
      this.prisma.workflowInstance.count({
        where: { tenantId, status: WorkflowInstanceStatus.PENDING },
      }),
      // Approved
      this.prisma.workflowInstance.count({
        where: { tenantId, status: WorkflowInstanceStatus.APPROVED },
      }),
      // Rejected
      this.prisma.workflowInstance.count({
        where: { tenantId, status: WorkflowInstanceStatus.REJECTED },
      }),
      // Escalated Steps
      this.prisma.workflowInstanceStep.count({
        where: {
          tenantId,
          status: WorkflowStepStatus.PENDING,
          isEscalated: true,
        },
      }),
      // Overdue Steps
      this.prisma.workflowInstanceStep.count({
        where: {
          tenantId,
          status: WorkflowStepStatus.PENDING,
          deadlineAt: { lt: new Date() },
        },
      }),
      // My Tasks
      this.prisma.workflowInstanceStep.count({
        where: {
          tenantId,
          status: WorkflowStepStatus.PENDING,
          assignedApproverId: userId,
        },
      }),
      // Team Tasks (Role-based pending approvals where user shares role)
      this.prisma.workflowInstanceStep.count({
        where: {
          tenantId,
          status: WorkflowStepStatus.PENDING,
          step: {
            approverType: "ROLE",
            approverValue: {
              in: user.roles || [],
            },
          },
        },
      }),
    ]);

    return {
      pending,
      approved,
      rejected,
      escalated,
      overdue,
      myTasks,
      teamTasks,
    };
  }

  // --- SEARCH & FILTERS ---

  async searchInstances(query: any, user: AuthUser) {
    const tenantId = user.tenantId!;
    const where: Prisma.WorkflowInstanceWhereInput = { tenantId };

    if (query.workflowCode) {
      where.definition = { code: query.workflowCode };
    }
    if (query.entityType) {
      where.entityType = query.entityType;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.initiatorId) {
      where.initiatedById = query.initiatorId;
    }
    if (query.approverId) {
      where.steps = {
        some: {
          assignedApproverId: query.approverId,
        },
      };
    }
    if (query.startDate || query.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.startDate) dateFilter.gte = new Date(query.startDate);
      if (query.endDate) dateFilter.lte = new Date(query.endDate);
      where.createdAt = dateFilter;
    }

    return this.prisma.workflowInstance.findMany({
      where,
      include: {
        definition: true,
        initiatedBy: {
          select: { id: true, username: true, email: true },
        },
        steps: {
          orderBy: { level: "asc" },
          include: {
            assignedApprover: {
              select: { id: true, username: true, email: true },
            },
            actionedBy: {
              select: { id: true, username: true, email: true },
            },
            step: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- HELPER UTILITIES ---

  private async fetchEntityDetails(
    tenantId: string,
    entityType: string,
    entityId: string,
  ): Promise<any> {
    const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);
    try {
      if (
        (this.prisma as any)[modelName] &&
        typeof (this.prisma as any)[modelName].findFirst === "function"
      ) {
        const details = await (this.prisma as any)[modelName].findFirst({
          where: { id: entityId, tenantId },
        });
        return details || {};
      }
    } catch {
      // fallback
    }
    return {};
  }

  private evaluateConditions(entityData: any, conditions: any): boolean {
    if (!conditions || Object.keys(conditions).length === 0) return true;

    // Supports: greater than, less than, equal, not equal, contains, in-list
    for (const key of Object.keys(conditions)) {
      const val = entityData[key];
      const rules = conditions[key];

      for (const op of Object.keys(rules)) {
        const target = rules[op];

        if (op === "gt" || op === "greaterThan") {
          if (!(Number(val) > Number(target))) return false;
        } else if (op === "lt" || op === "lessThan") {
          if (!(Number(val) < Number(target))) return false;
        } else if (op === "eq" || op === "equal") {
          if (val !== target) return false;
        } else if (op === "ne" || op === "notEqual") {
          if (val === target) return false;
        } else if (op === "contains") {
          if (!String(val).toLowerCase().includes(String(target).toLowerCase()))
            return false;
        } else if (op === "in" || op === "in-list") {
          if (!Array.isArray(target) || !target.includes(val)) return false;
        }
      }
    }

    return true;
  }

  private checkAutoApproval(
    entityData: any,
    conditions: any,
    entityType: string,
  ): boolean {
    // Configurable Auto approval criteria:
    // e.g. LeaveRequest duration <= 1 day, ExpenseClaim amount <= configured threshold
    if (entityType === "LeaveRequest") {
      const duration = entityData.duration || 0;
      if (duration <= 1) return true;
    } else if (entityType === "ExpenseClaim") {
      const amount = Number(entityData.totalAmount || 0);
      if (amount <= 500) return true; // threshold is 500
    } else if (entityType === "PurchaseOrder") {
      const amount = Number(entityData.totalAmount || 0);
      if (amount <= 1000) return true; // threshold is 1000
    }
    return false;
  }

  private async resolveApproverUserIds(
    tx: PrismaTx,
    tenantId: string,
    approverType: string,
    approverValue: string | null,
    initiatorUserId: string,
  ): Promise<string[]> {
    if (approverType === "USER") {
      return approverValue ? [approverValue] : [];
    }

    if (approverType === "REPORTING_MANAGER") {
      const initiatorUser = await tx.user.findUnique({
        where: { id: initiatorUserId },
      });
      if (initiatorUser) {
        const initiatorEmp = await tx.employee.findFirst({
          where: { tenantId, email: initiatorUser.email, deletedAt: null },
        });

        if (initiatorEmp && initiatorEmp.reportingManagerId) {
          const managerEmp = await tx.employee.findUnique({
            where: { id: initiatorEmp.reportingManagerId },
          });
          if (managerEmp) {
            const managerUser = await tx.user.findFirst({
              where: { email: managerEmp.email, tenantId },
            });
            return managerUser ? [managerUser.id] : [];
          }
        }
      }
      return [];
    }

    if (approverType === "ROLE") {
      if (!approverValue) return [];
      const roleUsers = await tx.userRole.findMany({
        where: { tenantId, role: { name: approverValue } },
        select: { userId: true },
      });
      return roleUsers.map((ru) => ru.userId);
    }

    if (approverType === "AND" || approverType === "OR") {
      if (!approverValue) return [];
      // Value is comma-separated user IDs or role names
      const values = approverValue.split(",").map((v) => v.trim());
      const userIds: string[] = [];

      for (const val of values) {
        if (this.isUUID(val)) {
          userIds.push(val);
        } else {
          // treat as Role
          const roleUsers = await tx.userRole.findMany({
            where: { tenantId, role: { name: val } },
            select: { userId: true },
          });
          userIds.push(...roleUsers.map((ru) => ru.userId));
        }
      }
      return Array.from(new Set(userIds));
    }

    return [];
  }

  private async verifyApproverAuthorization(
    tx: PrismaTx,
    tenantId: string,
    userId: string,
    step: any,
    userRoles: string[],
  ): Promise<boolean> {
    if (step.assignedApproverId === userId) {
      return true;
    }

    if (step.step.approverType === "ROLE") {
      return userRoles.includes(step.step.approverValue);
    }

    if (step.step.approverType === "OR" || step.step.approverType === "AND") {
      const allowedUsers = await this.resolveApproverUserIds(
        tx,
        tenantId,
        step.step.approverType,
        step.step.approverValue,
        step.instance.initiatedById,
      );
      return allowedUsers.includes(userId);
    }

    return false;
  }

  private isUUID(str: string): boolean {
    const regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return regex.test(str);
  }
}

// Helpers
function dtoToEntityMap(entityType: string, entityData: any): any {
  if (entityType === "LeaveRequest") {
    // If leave request, calculate duration from dates
    const start = new Date(entityData.startDate);
    const end = new Date(entityData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return { ...entityData, duration };
  }
  return entityData;
}
