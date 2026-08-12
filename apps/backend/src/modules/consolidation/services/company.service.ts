import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { CreateCompanyDto } from "../dto/create-company.dto";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createCompany(tenantId: string, dto: CreateCompanyDto, user: AuthUser) {
    // Check if code is already in use
    const exists = await this.prisma.company.findFirst({
      where: { tenantId, code: dto.code },
    });
    if (exists) {
      throw new ConflictException(
        `Company code ${dto.code} is already in use.`,
      );
    }

    if (dto.parentId) {
      const parentExists = await this.prisma.company.findFirst({
        where: { tenantId, id: dto.parentId },
      });
      if (!parentExists) {
        throw new NotFoundException("Parent company not found.");
      }
    }

    const company = await this.prisma.company.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        legalName: dto.legalName,
        taxId: dto.taxId || null,
        baseCurrency: dto.baseCurrency,
        country: dto.country,
        parentId: dto.parentId || null,
        isConsolidationEntity: dto.isConsolidationEntity || false,
      },
    });

    await this.auditService.log({
      action: "COMPANY_CREATED",
      entity: "Company",
      entityId: company.id,
      newValues: {
        id: company.id,
        name: company.name,
        code: company.code,
      },
      userId: user.id,
      tenantId,
    });

    return company;
  }

  async updateCompany(
    tenantId: string,
    id: string,
    dto: Partial<CreateCompanyDto>,
    user: AuthUser,
  ) {
    const company = await this.prisma.company.findFirst({
      where: { tenantId, id },
    });
    if (!company) {
      throw new NotFoundException("Company not found.");
    }

    if (dto.code && dto.code !== company.code) {
      const exists = await this.prisma.company.findFirst({
        where: { tenantId, code: dto.code, id: { not: id } },
      });
      if (exists) {
        throw new ConflictException(
          `Company code ${dto.code} is already in use.`,
        );
      }
    }

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        legalName: dto.legalName,
        taxId: dto.taxId,
        baseCurrency: dto.baseCurrency,
        country: dto.country,
        parentId: dto.parentId,
        isConsolidationEntity: dto.isConsolidationEntity,
        version: { increment: 1 },
      },
    });

    await this.auditService.log({
      action: "COMPANY_UPDATED",
      entity: "Company",
      entityId: id,
      oldValues: {
        name: company.name,
        code: company.code,
      },
      newValues: {
        name: updated.name,
        code: updated.code,
      },
      userId: user.id,
      tenantId,
    });

    return updated;
  }

  async getCompanyById(tenantId: string, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { tenantId, id },
      include: { parent: true, subsidiaries: true },
    });
    if (!company) {
      throw new NotFoundException("Company not found.");
    }
    return company;
  }

  async getCompanyHierarchy(tenantId: string) {
    const companies = await this.prisma.company.findMany({
      where: { tenantId },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companyMap = new Map<string, any>();
    companies.forEach((c) => {
      companyMap.set(c.id, { ...c, children: [] });
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roots: any[] = [];
    companyMap.forEach((c) => {
      if (c.parentId) {
        const parent = companyMap.get(c.parentId);
        if (parent) {
          parent.children.push(c);
        } else {
          roots.push(c);
        }
      } else {
        roots.push(c);
      }
    });

    return roots;
  }

  async assignPermission(
    tenantId: string,
    userId: string,
    companyId: string,
    roleId: string,
    user: AuthUser,
  ) {
    const permission = await this.prisma.companyPermission.upsert({
      where: {
        tenantId_userId_companyId_roleId: {
          tenantId,
          userId,
          companyId,
          roleId,
        },
      },
      create: {
        tenantId,
        userId,
        companyId,
        roleId,
      },
      update: {},
    });

    await this.auditService.log({
      action: "COMPANY_PERMISSION_ASSIGNED",
      entity: "CompanyPermission",
      entityId: permission.id,
      newValues: { userId, companyId, roleId },
      userId: user.id,
      tenantId,
    });

    return permission;
  }

  async revokePermission(
    tenantId: string,
    userId: string,
    companyId: string,
    roleId: string,
    user: AuthUser,
  ) {
    const permission = await this.prisma.companyPermission.findFirst({
      where: { tenantId, userId, companyId, roleId },
    });

    if (!permission) {
      throw new NotFoundException("Company permission not found.");
    }

    await this.prisma.companyPermission.delete({
      where: { id: permission.id },
    });

    await this.auditService.log({
      action: "COMPANY_PERMISSION_REVOKED",
      entity: "CompanyPermission",
      entityId: permission.id,
      oldValues: { userId, companyId, roleId },
      userId: user.id,
      tenantId,
    });

    return { success: true };
  }
}
