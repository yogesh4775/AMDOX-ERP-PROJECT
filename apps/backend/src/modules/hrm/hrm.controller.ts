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
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { HRMService } from "./hrm.service";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { QueryEmployeeDto } from "./dto/query-employee.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { AuditService } from "../../common/audit/audit.service";

@Controller("hrm")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HRMController {
  constructor(
    private readonly hrmService: HRMService,
    private readonly auditService: AuditService,
  ) {}

  @Get("employees")
  @Permissions(PermissionsList.HRM_EMPLOYEE_READ)
  async getEmployees(
    @Query() query: QueryEmployeeDto,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const list = await this.hrmService.getEmployees(query, req.user);

    if (query.export === "csv") {
      let csv =
        "Employee Code,First Name,Last Name,Email,Phone,Department,Designation,Manager,Employment Type,Status,Joining Date,Confirmation Date,Separation Date\n";
      for (const e of list) {
        const dept = e.department?.name || "";
        const des = e.designation?.name || "";
        const mgrName = e.reportingManager
          ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}`
          : "";
        const jDate = e.joiningDate ? e.joiningDate.toISOString() : "";
        const cDate = e.confirmationDate
          ? e.confirmationDate.toISOString()
          : "";
        const sDate = e.separationDate ? e.separationDate.toISOString() : "";

        csv += `"${e.employeeCode}","${e.firstName}","${e.lastName}","${e.email}","${e.phone || ""}","${dept}","${des}","${mgrName}","${e.employmentType}","${e.status}","${jDate}","${cDate}","${sDate}"\n`;
      }

      await this.auditService.log({
        action: "HRM_DIRECTORY_EXPORTED",
        entity: "Employee",
        entityId: "all",
        tenantId: req.user.tenantId!,
        userId: req.user.id,
        newValues: { format: "csv" },
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="employee_directory.csv"',
      );
      return res.send(csv);
    }

    return res.json(list);
  }

  @Post("employees")
  @Permissions(PermissionsList.HRM_EMPLOYEE_WRITE)
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.hrmService.createEmployee(dto, req.user);
  }

  @Get("employees/:id")
  @Permissions(PermissionsList.HRM_EMPLOYEE_READ)
  async getEmployeeById(
    @Param("id") id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.hrmService.getEmployeeById(id, req.user);
  }

  @Patch("employees/:id")
  @Permissions(PermissionsList.HRM_EMPLOYEE_WRITE)
  async updateEmployee(
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.hrmService.updateEmployee(id, dto, req.user);
  }

  @Post("employees/:id/documents")
  @Permissions(PermissionsList.HRM_DOCUMENT_WRITE)
  async addDocument(
    @Param("id") id: string,
    @Body() dto: CreateDocumentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.hrmService.addDocument(id, dto, req.user);
  }

  @Delete("employees/:id/documents/:docId")
  @Permissions(PermissionsList.HRM_DOCUMENT_WRITE)
  async removeDocument(
    @Param("id") id: string,
    @Param("docId") docId: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.hrmService.removeDocument(id, docId, req.user);
  }

  @Get("dashboard")
  @Permissions(PermissionsList.HRM_DASHBOARD_READ)
  async getDashboardSummary(@Req() req: { user: AuthUser }) {
    return this.hrmService.getDashboardSummary(req.user);
  }
}
