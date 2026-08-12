import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
  EmployeeStatus,
  EmploymentType,
  MasterStatus,
} from "@amdox/database/generated";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { QueryEmployeeDto } from "./dto/query-employee.dto";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Injectable()
export class HRMService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- EMPLOYEE CRUD ---
  async createEmployee(dto: CreateEmployeeDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Validate unique employeeCode
    const dupCode = await this.prisma.employee.findFirst({
      where: { tenantId, employeeCode: dto.employeeCode, deletedAt: null },
    });
    if (dupCode) {
      throw new BadRequestException(
        `Employee with code ${dto.employeeCode} already exists.`,
      );
    }

    // Validate unique email
    const dupEmail = await this.prisma.employee.findFirst({
      where: { tenantId, email: dto.email, deletedAt: null },
    });
    if (dupEmail) {
      throw new BadRequestException(
        `Employee with email ${dto.email} already exists.`,
      );
    }

    // Validate Department exists and is ACTIVE
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId, deletedAt: null },
      });
      if (!dept || dept.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException(
          "Department does not exist or is inactive.",
        );
      }
    }

    // Validate Designation exists and is ACTIVE
    if (dto.designationId) {
      const des = await this.prisma.designation.findFirst({
        where: { id: dto.designationId, tenantId, deletedAt: null },
      });
      if (!des || des.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException(
          "Designation does not exist or is inactive.",
        );
      }
    }

    // Validate Reporting Manager
    if (dto.reportingManagerId) {
      const mgr = await this.prisma.employee.findFirst({
        where: { id: dto.reportingManagerId, tenantId, deletedAt: null },
      });
      if (!mgr) {
        throw new BadRequestException(
          "Reporting manager must belong to the same tenant.",
        );
      }
    }

    const employee = await this.prisma.employee.create({
      data: {
        tenantId,
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        departmentId: dto.departmentId,
        designationId: dto.designationId,
        reportingManagerId: dto.reportingManagerId,
        employmentType: dto.employmentType || EmploymentType.FULL_TIME,
        status: EmployeeStatus.ACTIVE,
        joiningDate: new Date(dto.joiningDate),
      },
    });

    await this.auditService.log({
      action: "EMPLOYEE_CREATED",
      entity: "Employee",
      entityId: employee.id,
      tenantId,
      userId: user.id,
      newValues: employee,
    });

    await this.notificationsService.createInternal({
      userId: user.id,
      tenantId,
      title: "Employee Profile Created",
      message: `Employee profile for ${employee.firstName} ${employee.lastName} was created successfully.`,
      type: NotificationType.INFO,
    });

    return employee;
  }

  async getEmployees(query: QueryEmployeeDto, user: AuthUser) {
    const tenantId = user.tenantId!;
    const where: Prisma.EmployeeWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: "insensitive" } },
        { lastName: { contains: query.search, mode: "insensitive" } },
        { email: { contains: query.search, mode: "insensitive" } },
        { employeeCode: { contains: query.search, mode: "insensitive" } },
      ];
    }

    return this.prisma.employee.findMany({
      where,
      include: {
        department: true,
        designation: true,
        reportingManager: true,
      },
      orderBy: { employeeCode: "asc" },
    });
  }

  async getEmployeeById(id: string, user: AuthUser) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId: user.tenantId!, deletedAt: null },
      include: {
        department: true,
        designation: true,
        reportingManager: true,
        documents: {
          include: {
            mediaFile: true,
          },
        },
      },
    });
    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }
    return emp;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    // Optimistic Concurrency check
    if (emp.version !== dto.expectedVersion) {
      throw new ConflictException(
        "Optimistic lock conflict. Version mismatch.",
      );
    }

    // Validate Department exists and is ACTIVE
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId, deletedAt: null },
      });
      if (!dept || dept.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException(
          "Department does not exist or is inactive.",
        );
      }
    }

    // Validate Designation exists and is ACTIVE
    if (dto.designationId) {
      const des = await this.prisma.designation.findFirst({
        where: { id: dto.designationId, tenantId, deletedAt: null },
      });
      if (!des || des.status !== MasterStatus.ACTIVE) {
        throw new BadRequestException(
          "Designation does not exist or is inactive.",
        );
      }
    }

    // Validate Confirmation Date
    if (dto.confirmationDate) {
      const cDate = new Date(dto.confirmationDate);
      if (cDate < new Date(emp.joiningDate)) {
        throw new BadRequestException(
          "Confirmation date cannot be before joining date.",
        );
      }
    }

    // Validate Status Transitions & Separation
    if (
      dto.status === EmployeeStatus.TERMINATED ||
      dto.status === EmployeeStatus.RESIGNED
    ) {
      if (!dto.separationDate || !dto.separationReason) {
        throw new BadRequestException(
          "Separation date and reason are mandatory when status is TERMINATED or RESIGNED.",
        );
      }
      const sDate = new Date(dto.separationDate);
      if (sDate < new Date(emp.joiningDate)) {
        throw new BadRequestException(
          "Separation date cannot be before joining date.",
        );
      }
    }

    // Validate Reporting Manager
    if (dto.reportingManagerId) {
      if (dto.reportingManagerId === id) {
        throw new BadRequestException("Employee cannot report to themselves.");
      }

      const mgr = await this.prisma.employee.findFirst({
        where: { id: dto.reportingManagerId, tenantId, deletedAt: null },
      });
      if (!mgr) {
        throw new BadRequestException(
          "Reporting manager must belong to the same tenant.",
        );
      }

      // Cycle Prevention logic
      let currentMgrId: string | null = dto.reportingManagerId;
      while (currentMgrId) {
        if (currentMgrId === id) {
          throw new BadRequestException(
            "Circular reporting hierarchy detected.",
          );
        }
        const parentEmp: { reportingManagerId: string | null } | null =
          await this.prisma.employee.findFirst({
            where: { id: currentMgrId, tenantId, deletedAt: null },
            select: { reportingManagerId: true },
          });
        currentMgrId = parentEmp?.reportingManagerId || null;
      }
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const updated = await tx.employee.update({
        where: { id },
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          departmentId: dto.departmentId,
          designationId: dto.designationId,
          reportingManagerId: dto.reportingManagerId,
          employmentType: dto.employmentType,
          status: dto.status,
          confirmationDate: dto.confirmationDate
            ? new Date(dto.confirmationDate)
            : undefined,
          separationDate: dto.separationDate
            ? new Date(dto.separationDate)
            : undefined,
          separationReason: dto.separationReason,
          version: emp.version + 1,
        },
      });

      // Audit and Notification integrations
      let auditAction = "EMPLOYEE_UPDATED";
      if (dto.confirmationDate && !emp.confirmationDate) {
        auditAction = "EMPLOYEE_CONFIRMED";
        await tx.auditLog.create({
          data: {
            action: auditAction,
            entity: "Employee",
            entityId: id,
            tenantId,
            userId: user.id,
            newValues: JSON.parse(JSON.stringify(updated)),
          },
        });
        await this.notificationsService.createInternal({
          userId: user.id,
          tenantId,
          title: "Employee Confirmed",
          message: `Employee ${updated.firstName} ${updated.lastName} has been confirmed.`,
          type: NotificationType.INFO,
        });
      } else if (dto.status === EmployeeStatus.RESIGNED) {
        auditAction = "EMPLOYEE_RESIGNED";
        await tx.auditLog.create({
          data: {
            action: auditAction,
            entity: "Employee",
            entityId: id,
            tenantId,
            userId: user.id,
            newValues: JSON.parse(JSON.stringify(updated)),
          },
        });
        await this.notificationsService.createInternal({
          userId: user.id,
          tenantId,
          title: "Employee Resigned",
          message: `Employee ${updated.firstName} ${updated.lastName} has resigned.`,
          type: NotificationType.INFO,
        });
      } else if (dto.status === EmployeeStatus.TERMINATED) {
        auditAction = "EMPLOYEE_TERMINATED";
        await tx.auditLog.create({
          data: {
            action: auditAction,
            entity: "Employee",
            entityId: id,
            tenantId,
            userId: user.id,
            newValues: JSON.parse(JSON.stringify(updated)),
          },
        });
        await this.notificationsService.createInternal({
          userId: user.id,
          tenantId,
          title: "Employee Terminated",
          message: `Employee ${updated.firstName} ${updated.lastName} has been terminated.`,
          type: NotificationType.INFO,
        });
      } else {
        await tx.auditLog.create({
          data: {
            action: auditAction,
            entity: "Employee",
            entityId: id,
            tenantId,
            userId: user.id,
            newValues: JSON.parse(JSON.stringify(updated)),
          },
        });
      }

      return updated;
    });
  }

  // --- DOCUMENT MANAGEMENT ---
  async addDocument(id: string, dto: CreateDocumentDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    const emp = await this.prisma.employee.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!emp) {
      throw new NotFoundException(`Employee with ID ${id} not found.`);
    }

    // Verify media file
    const media = await this.prisma.mediaFile.findFirst({
      where: { id: dto.mediaFileId, tenantId, deletedAt: null },
    });
    if (!media) {
      throw new BadRequestException(
        "Media file does not exist, is inactive or belongs to a different tenant.",
      );
    }

    // Block duplicate document links
    const dupDoc = await this.prisma.employeeDocument.findFirst({
      where: { employeeId: id, mediaFileId: dto.mediaFileId },
    });
    if (dupDoc) {
      throw new BadRequestException(
        "This media file is already attached as a document to this employee.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const doc = await tx.employeeDocument.create({
        data: {
          tenantId,
          employeeId: id,
          documentName: dto.documentName,
          documentType: dto.documentType,
          mediaFileId: dto.mediaFileId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_DOCUMENT_ADDED",
          entity: "EmployeeDocument",
          entityId: doc.id,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(doc)),
        },
      });

      return doc;
    });
  }

  async removeDocument(id: string, docId: string, user: AuthUser) {
    const tenantId = user.tenantId!;

    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id: docId, employeeId: id, tenantId },
    });
    if (!doc) {
      throw new NotFoundException(
        `Document with ID ${docId} not found under Employee ${id}.`,
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      await tx.employeeDocument.delete({
        where: { id: docId },
      });

      await tx.auditLog.create({
        data: {
          action: "EMPLOYEE_DOCUMENT_REMOVED",
          entity: "EmployeeDocument",
          entityId: docId,
          tenantId,
          userId: user.id,
          newValues: JSON.parse(JSON.stringify(doc)),
        },
      });

      return { success: true };
    });
  }

  // --- HR DASHBOARD METRICS ---
  async getDashboardSummary(user: AuthUser) {
    const tenantId = user.tenantId!;

    const total = await this.prisma.employee.count({
      where: { tenantId, deletedAt: null },
    });

    const active = await this.prisma.employee.count({
      where: { tenantId, status: EmployeeStatus.ACTIVE, deletedAt: null },
    });

    const inactive = await this.prisma.employee.count({
      where: { tenantId, status: EmployeeStatus.INACTIVE, deletedAt: null },
    });

    const confirmed = await this.prisma.employee.count({
      where: { tenantId, confirmationDate: { not: null }, deletedAt: null },
    });

    const confirmedRate =
      total > 0 ? Number(((confirmed / total) * 100).toFixed(2)) : 0;

    // Department Distribution
    const deptGroups = await this.prisma.employee.groupBy({
      by: ["departmentId"],
      where: { tenantId, deletedAt: null },
      _count: { id: true },
    });

    const depts = await this.prisma.department.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, name: true },
    });

    const deptDistribution = deptGroups.map((g) => {
      const name =
        depts.find((d) => d.id === g.departmentId)?.name || "Unassigned";
      return { department: name, count: g._count.id };
    });

    // Average Tenure Calculation
    const allEmps = await this.prisma.employee.findMany({
      where: { tenantId, deletedAt: null },
      select: { joiningDate: true, separationDate: true },
    });

    let totalDays = 0;
    const now = new Date();
    for (const e of allEmps) {
      const end = e.separationDate ? new Date(e.separationDate) : now;
      const days = Math.max(
        0,
        Math.floor(
          (end.getTime() - new Date(e.joiningDate).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );
      totalDays += days;
    }
    const averageTenureDays = total > 0 ? Math.floor(totalDays / total) : 0;

    // Joiners & Separations counts in current year
    const currentYear = now.getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    const newJoiners = await this.prisma.employee.count({
      where: {
        tenantId,
        joiningDate: { gte: yearStart },
        deletedAt: null,
      },
    });

    const separations = await this.prisma.employee.count({
      where: {
        tenantId,
        separationDate: { gte: yearStart },
        deletedAt: null,
      },
    });

    return {
      totalEmployees: total,
      activeEmployees: active,
      inactiveEmployees: inactive,
      departmentDistribution: deptDistribution,
      averageTenureDays,
      confirmationRate: confirmedRate,
      newJoiners,
      separations,
    };
  }
}
