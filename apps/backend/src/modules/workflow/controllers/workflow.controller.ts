import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { WorkflowService } from "../services/workflow.service";
import { CreateDefinitionDto } from "../dto/create-definition.dto";
import { UpdateDefinitionDto } from "../dto/update-definition.dto";
import { CreateDelegationDto } from "../dto/create-delegation.dto";
import { WorkflowActionDto } from "../dto/workflow-action.dto";
import { SubmitInstanceDto } from "../dto/submit-instance.dto";
import { ReassignTaskDto } from "../dto/reassign-task.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("workflows")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  // --- WORKFLOW DEFINITIONS ---

  @Post("definitions")
  @Permissions(PermissionsList.WORKFLOW_DEFINITION_WRITE)
  async createDefinition(
    @Body() dto: CreateDefinitionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.createDefinition(dto, req.user);
  }

  @Patch("definitions/:id")
  @Permissions(PermissionsList.WORKFLOW_DEFINITION_WRITE)
  async updateDefinition(
    @Param("id") id: string,
    @Body() dto: UpdateDefinitionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.updateDefinition(id, dto, req.user);
  }

  @Delete("definitions/:id")
  @Permissions(PermissionsList.WORKFLOW_DEFINITION_WRITE)
  async deleteDefinition(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.deleteDefinition(id, req.user);
  }

  @Get("definitions")
  @Permissions(PermissionsList.WORKFLOW_DEFINITION_READ)
  async listDefinitions(@Req() req: { user: AuthUser }) {
    return this.workflowService.listDefinitions(req.user);
  }

  @Get("definitions/:id")
  @Permissions(PermissionsList.WORKFLOW_DEFINITION_READ)
  async getDefinition(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.workflowService.getDefinition(id, req.user);
  }

  // --- WORKFLOW INSTANCES ---

  @Post("instances/submit")
  @Permissions(PermissionsList.WORKFLOW_INSTANCE_WRITE)
  async submitInstance(
    @Body() dto: SubmitInstanceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.submitInstance(dto, req.user);
  }

  @Get("instances/search")
  @Permissions(PermissionsList.WORKFLOW_INSTANCE_READ)
  async searchInstances(
    @Query() query: Record<string, unknown>,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.searchInstances(query, req.user);
  }

  // --- STEP ACTION & REASSIGNMENT ---

  @Post("approvals/:stepId/action")
  @Permissions(PermissionsList.WORKFLOW_APPROVAL_ACTION)
  async actionStep(
    @Param("stepId") stepId: string,
    @Body() dto: WorkflowActionDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.actionStep(stepId, dto, req.user);
  }

  @Post("reassign/:stepId")
  @Permissions(PermissionsList.WORKFLOW_REASSIGN_WRITE)
  async reassignTask(
    @Param("stepId") stepId: string,
    @Body() dto: ReassignTaskDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.reassignTask(stepId, dto, req.user);
  }

  // --- DELEGATIONS ---

  @Post("delegations")
  @Permissions(PermissionsList.WORKFLOW_DELEGATION_WRITE)
  async createDelegation(
    @Body() dto: CreateDelegationDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.createDelegation(dto, req.user);
  }

  @Delete("delegations/:id")
  @Permissions(PermissionsList.WORKFLOW_DELEGATION_WRITE)
  async revokeDelegation(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.workflowService.revokeDelegation(id, req.user);
  }

  // --- SLA / ESCALATIONS TRIGGER (CRON / MANUAL) ---

  @Post("escalations/process")
  async processSLAAndEscalations(@Req() req: { user: AuthUser }) {
    await this.workflowService.processSLAAndEscalations(req.user.tenantId!);
    return { success: true };
  }

  // --- DASHBOARD WIDGETS ---

  @Get("dashboard")
  @Permissions(PermissionsList.DASHBOARD_READ)
  async getDashboardStats(@Req() req: { user: AuthUser }) {
    return this.workflowService.getDashboardStats(req.user);
  }
}
