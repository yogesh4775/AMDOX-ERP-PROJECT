import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../common/audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { LeaveService } from "../leave/leave.service";
import { AccountingService } from "../accounting/accounting.service";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { CreateComponentDto } from "./dto/create-component.dto";
import { CreateStructureDto } from "./dto/create-structure.dto";
import { AssignSalaryDto } from "./dto/assign-salary.dto";
import { CreatePeriodDto } from "./dto/create-period.dto";
import { QueryPayrollDto } from "./dto/query-payroll.dto";
import { NotificationType } from "../notifications/dto/query-notification.dto";
import {
  TransactionHelper,
  PrismaTx,
} from "../../common/transactions/transaction.helper";
import {
  Prisma,
  SalaryComponent,
  SalaryStructure,
  EmployeeSalaryAssignment,
  PayrollPeriod,
  SalaryComponentType,
  CalculationType,
  PayrollPeriodStatus,
  PayslipStatus,
  EmployeeStatus,
  AccountType,
  AccountStatus,
  JournalEntryStatus,
  JournalSourceType,
} from "@amdox/database/generated";

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly leaveService: LeaveService,
    private readonly accountingService: AccountingService,
    private readonly transactionHelper: TransactionHelper,
  ) {}

  // --- SALARY COMPONENTS ---
  async createComponent(
    dto: CreateComponentDto,
    user: AuthUser,
  ): Promise<SalaryComponent> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    // Unique code check
    const existingCode = await this.prisma.salaryComponent.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existingCode) {
      throw new BadRequestException(
        `Component code ${dto.code} already exists.`,
      );
    }

    // Unique name check
    const existingName = await this.prisma.salaryComponent.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existingName) {
      throw new BadRequestException(
        `Component name ${dto.name} already exists.`,
      );
    }

    // Percentage values validation
    if (dto.calculationType === CalculationType.PERCENTAGE) {
      if (dto.value < 0 || dto.value > 100) {
        throw new BadRequestException(
          "Percentage values must be between 0 and 100.",
        );
      }
    } else {
      if (dto.value < 0) {
        throw new BadRequestException("Flat values cannot be negative.");
      }
    }

    const component = await this.prisma.salaryComponent.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        calculationType: dto.calculationType,
        value: new Prisma.Decimal(dto.value),
      },
    });

    await this.auditService.log({
      action: "SALARY_COMPONENT_CREATED",
      entity: "SalaryComponent",
      entityId: component.id,
      tenantId,
      userId: user.id,
      newValues: component,
    });

    return component;
  }

  // --- SALARY STRUCTURES ---
  async createStructure(
    dto: CreateStructureDto,
    user: AuthUser,
  ): Promise<SalaryStructure> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    if (dto.baseSalary <= 0) {
      throw new BadRequestException("Base Salary must be greater than 0.");
    }

    // Unique code check
    const existingCode = await this.prisma.salaryStructure.findUnique({
      where: { tenantId_code: { tenantId, code: dto.code } },
    });
    if (existingCode) {
      throw new BadRequestException(
        `Structure code ${dto.code} already exists.`,
      );
    }

    // Unique name check
    const existingName = await this.prisma.salaryStructure.findUnique({
      where: { tenantId_name: { tenantId, name: dto.name } },
    });
    if (existingName) {
      throw new BadRequestException(
        `Structure name ${dto.name} already exists.`,
      );
    }

    // Prevent duplicate components inside structure
    if (dto.componentIds && dto.componentIds.length > 0) {
      const uniqueIds = new Set(dto.componentIds);
      if (uniqueIds.size !== dto.componentIds.length) {
        throw new BadRequestException(
          "Duplicate components inside one salary structure are blocked.",
        );
      }

      // Verify they exist and are active
      const components = await this.prisma.salaryComponent.findMany({
        where: { id: { in: dto.componentIds }, tenantId },
      });
      if (components.length !== dto.componentIds.length) {
        throw new BadRequestException(
          "One or more assigned salary components are invalid.",
        );
      }
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      const structure = await tx.salaryStructure.create({
        data: {
          tenantId,
          name: dto.name,
          code: dto.code,
          baseSalary: new Prisma.Decimal(dto.baseSalary),
        },
      });

      if (dto.componentIds && dto.componentIds.length > 0) {
        await tx.salaryStructureComponent.createMany({
          data: dto.componentIds.map((cId) => ({
            tenantId,
            salaryStructureId: structure.id,
            salaryComponentId: cId,
          })),
        });
      }

      await this.auditService.log({
        action: "SALARY_STRUCTURE_CREATED",
        entity: "SalaryStructure",
        entityId: structure.id,
        tenantId,
        userId: user.id,
        newValues: structure,
      });

      return structure;
    });
  }

  // --- SALARY ASSIGNMENTS ---
  async assignSalary(
    dto: AssignSalaryDto,
    user: AuthUser,
  ): Promise<EmployeeSalaryAssignment> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const emp = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, tenantId, deletedAt: null },
    });
    if (!emp) {
      throw new NotFoundException(`Employee ${dto.employeeId} not found.`);
    }
    if (emp.status !== EmployeeStatus.ACTIVE) {
      throw new BadRequestException("Employee must be ACTIVE.");
    }

    const struct = await this.prisma.salaryStructure.findFirst({
      where: { id: dto.salaryStructureId, tenantId },
    });
    if (!struct) {
      throw new NotFoundException(
        `Salary Structure ${dto.salaryStructureId} not found.`,
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new BadRequestException("End Date cannot be before Start Date.");
    }

    // Check overlaps
    const existing = await this.prisma.employeeSalaryAssignment.findMany({
      where: { employeeId: dto.employeeId, tenantId },
    });

    for (const assignment of existing) {
      const assignStart = new Date(assignment.startDate);
      const assignEnd = assignment.endDate
        ? new Date(assignment.endDate)
        : null;

      const overlap =
        (!endDate || assignStart <= endDate) &&
        (!assignEnd || startDate <= assignEnd);

      if (overlap) {
        throw new BadRequestException(
          "Assignment dates cannot overlap with existing assignments.",
        );
      }
    }

    const assignment = await this.prisma.employeeSalaryAssignment.create({
      data: {
        tenantId,
        employeeId: dto.employeeId,
        salaryStructureId: dto.salaryStructureId,
        startDate,
        endDate,
      },
    });

    await this.auditService.log({
      action: "SALARY_ASSIGNED",
      entity: "EmployeeSalaryAssignment",
      entityId: assignment.id,
      tenantId,
      userId: user.id,
      newValues: assignment,
    });

    await this.notificationsService.createInternal({
      userId: user.id,
      tenantId,
      title: "Salary Structure Assigned",
      message: `Employee ${emp.firstName} ${emp.lastName} has been assigned salary structure ${struct.name}.`,
      type: NotificationType.INFO,
    });

    return assignment;
  }

  // --- PAYROLL PERIODS ---
  async createPeriod(
    dto: CreatePeriodDto,
    user: AuthUser,
  ): Promise<PayrollPeriod> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException("End Date cannot be before Start Date.");
    }

    // Only one payroll period per month check
    const startMonth = startDate.getMonth();
    const startYear = startDate.getFullYear();

    const existing = await this.prisma.payrollPeriod.findMany({
      where: { tenantId },
    });

    for (const p of existing) {
      const pStart = new Date(p.startDate);
      const pEnd = new Date(p.endDate);

      // Check month collision
      if (
        pStart.getMonth() === startMonth &&
        pStart.getFullYear() === startYear
      ) {
        throw new BadRequestException(
          "Only one payroll period per month is allowed.",
        );
      }

      // Check overlap
      const overlap = pStart <= endDate && startDate <= pEnd;
      if (overlap) {
        throw new BadRequestException("Payroll period dates cannot overlap.");
      }
    }

    return this.prisma.payrollPeriod.create({
      data: {
        tenantId,
        name: dto.name,
        startDate,
        endDate,
        status: PayrollPeriodStatus.DRAFT,
      },
    });
  }

  // --- PAYROLL PROCESSING ---
  async processPayroll(periodId: string, user: AuthUser): Promise<unknown[]> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) {
      throw new NotFoundException(`Payroll Period ${periodId} not found.`);
    }
    if (period.status === PayrollPeriodStatus.LOCKED) {
      throw new BadRequestException("Locked payroll periods become immutable.");
    }

    // Find all active employees who have assignments spanning this period
    const assignments = await this.prisma.employeeSalaryAssignment.findMany({
      where: {
        tenantId,
        startDate: { lte: period.endDate },
        OR: [{ endDate: null }, { endDate: { gte: period.startDate } }],
        employee: { status: EmployeeStatus.ACTIVE },
      },
      include: {
        employee: true,
        salaryStructure: {
          include: {
            components: {
              include: {
                salaryComponent: true,
              },
            },
          },
        },
      },
    });

    const resultPayslips: unknown[] = [];

    await this.transactionHelper.run(async (tx: PrismaTx) => {
      for (const assign of assignments) {
        const emp = assign.employee;
        const struct = assign.salaryStructure;
        const base = struct.baseSalary;

        // Calculate LWP days (Leave Without Pay)
        const lwpDays = await this.leaveService.getUnpaidLeaveDays(
          emp.id,
          period.startDate,
          period.endDate,
        );
        const lwpDeduction = base.div(30).mul(lwpDays).toDecimalPlaces(2);

        // Calculate Overtime Pay from Attendance records
        const attendance = await tx.attendanceRecord.aggregate({
          where: {
            employeeId: emp.id,
            tenantId,
            date: { gte: period.startDate, lte: period.endDate },
          },
          _sum: {
            overtimeHours: true,
          },
        });
        const otHours = attendance._sum.overtimeHours
          ? Number(attendance._sum.overtimeHours)
          : 0;
        // Overtime rate: (Base / 240) * 1.5
        const otHourlyRate = base.div(240).mul(1.5);
        const overtimePay = otHourlyRate.mul(otHours).toDecimalPlaces(2);

        // Process Components (Earnings & Deductions)
        let totalEarnings = new Prisma.Decimal(0);
        let totalDeductions = new Prisma.Decimal(0);

        for (const mapping of struct.components) {
          const comp = mapping.salaryComponent;
          let compVal = new Prisma.Decimal(0);

          if (comp.calculationType === CalculationType.PERCENTAGE) {
            compVal = base.mul(comp.value).div(100).toDecimalPlaces(2);
          } else {
            compVal = comp.value;
          }

          if (comp.type === SalaryComponentType.EARNING) {
            totalEarnings = totalEarnings.add(compVal);
          } else {
            totalDeductions = totalDeductions.add(compVal);
          }
        }

        // Net Pay formula: Base Salary + Earnings + OvertimePay - Deductions - LWPDeduction
        const netPay = base
          .add(totalEarnings)
          .add(overtimePay)
          .sub(totalDeductions)
          .sub(lwpDeduction)
          .toDecimalPlaces(2);

        // Upsert Payslip
        const payslip = await tx.payslip.upsert({
          where: {
            tenantId_payrollPeriodId_employeeId: {
              tenantId,
              payrollPeriodId: period.id,
              employeeId: emp.id,
            },
          },
          create: {
            tenantId,
            payrollPeriodId: period.id,
            employeeId: emp.id,
            baseSalary: base,
            earnings: totalEarnings,
            deductions: totalDeductions,
            lwpDeduction,
            overtimePay,
            netPay,
            status: PayslipStatus.DRAFT,
          },
          update: {
            baseSalary: base,
            earnings: totalEarnings,
            deductions: totalDeductions,
            lwpDeduction,
            overtimePay,
            netPay,
            status: PayslipStatus.DRAFT,
          },
          include: {
            employee: true,
          },
        });

        resultPayslips.push(payslip);

        await tx.auditLog.create({
          data: {
            tenantId,
            userId: user.id,
            entity: "Payslip",
            entityId: payslip.id,
            action: "PAYSLIP_GENERATED",
            newValues: JSON.parse(JSON.stringify(payslip)),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          entity: "PayrollPeriod",
          entityId: period.id,
          action: "PAYROLL_PROCESSED",
          newValues: { processedCount: assignments.length },
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Payroll Processed",
        message: `Payroll processed for period ${period.name} with ${assignments.length} payslips.`,
        type: NotificationType.INFO,
      });
    });

    return resultPayslips;
  }

  // --- PAYROLL LOCKING & ACCOUNTING INTEGRATION ---
  async lockPayroll(
    id: string,
    expectedVersion: number,
    user: AuthUser,
  ): Promise<PayrollPeriod> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const period = await this.prisma.payrollPeriod.findUnique({
      where: { id },
      include: { payslips: true },
    });
    if (!period) {
      throw new NotFoundException(`Payroll Period ${id} not found.`);
    }
    if (period.status === PayrollPeriodStatus.LOCKED) {
      throw new BadRequestException("Locked payroll periods become immutable.");
    }
    if (period.version !== expectedVersion) {
      throw new ConflictException("Optimistic concurrency lock failed.");
    }

    if (period.payslips.length === 0) {
      throw new BadRequestException(
        "Cannot lock empty payroll period. Run payroll process first.",
      );
    }

    return this.transactionHelper.run(async (tx: PrismaTx) => {
      // Calculate totals
      let totalBase = new Prisma.Decimal(0);
      let totalEarnings = new Prisma.Decimal(0);
      let totalDeductions = new Prisma.Decimal(0);
      let totalLwp = new Prisma.Decimal(0);
      let totalOvertime = new Prisma.Decimal(0);
      let totalNet = new Prisma.Decimal(0);

      for (const p of period.payslips) {
        totalBase = totalBase.add(p.baseSalary);
        totalEarnings = totalEarnings.add(p.earnings);
        totalDeductions = totalDeductions.add(p.deductions);
        totalLwp = totalLwp.add(p.lwpDeduction);
        totalOvertime = totalOvertime.add(p.overtimePay);
        totalNet = totalNet.add(p.netPay);

        // Update Payslip status to APPROVED
        await tx.payslip.update({
          where: { id: p.id },
          data: { status: PayslipStatus.APPROVED, version: p.version + 1 },
        });
      }

      const totalGross = totalBase.add(totalEarnings).add(totalOvertime);
      const totalWithholdings = totalDeductions.add(totalLwp);

      // Debit/Credit math validation
      if (!totalGross.equals(totalNet.add(totalWithholdings))) {
        throw new BadRequestException(
          "Accounting validation failed: Debit does not equal Credit.",
        );
      }

      // Upsert GL Accounts (Salary Expense, Salary Payable, Deductions Payable)
      const expenseAcc = await tx.account.upsert({
        where: { tenantId_code: { tenantId, code: "500100" } },
        update: {},
        create: {
          tenantId,
          code: "500100",
          name: "Salary Expense",
          type: AccountType.EXPENSE,
          balance: new Prisma.Decimal(0),
          status: AccountStatus.ACTIVE,
        },
      });

      const payableAcc = await tx.account.upsert({
        where: { tenantId_code: { tenantId, code: "200100" } },
        update: {},
        create: {
          tenantId,
          code: "200100",
          name: "Salary Payable",
          type: AccountType.LIABILITY,
          balance: new Prisma.Decimal(0),
          status: AccountStatus.ACTIVE,
        },
      });

      const deductionsAcc = await tx.account.upsert({
        where: { tenantId_code: { tenantId, code: "200200" } },
        update: {},
        create: {
          tenantId,
          code: "200200",
          name: "Payroll Deductions Payable",
          type: AccountType.LIABILITY,
          balance: new Prisma.Decimal(0),
          status: AccountStatus.ACTIVE,
        },
      });

      // Generate Posting Entry Number
      const count = await tx.journalEntry.count({ where: { tenantId } });
      const entryNumber = `JV-PR-${period.name.replace(/\s+/g, "")}-${(count + 1).toString().padStart(4, "0")}`;

      // Create posted Journal Entry
      const journal = await tx.journalEntry.create({
        data: {
          tenantId,
          entryNumber,
          postingDate: period.endDate,
          status: JournalEntryStatus.POSTED,
          description: `Payroll Journal Post for period ${period.name}`,
          sourceType: JournalSourceType.MANUAL,
          lines: {
            create: [
              {
                tenantId,
                accountId: expenseAcc.id,
                debit: totalGross,
                credit: new Prisma.Decimal(0),
                description: `Gross Salaries - Period ${period.name}`,
              },
              {
                tenantId,
                accountId: payableAcc.id,
                debit: new Prisma.Decimal(0),
                credit: totalNet,
                description: `Net Salaries Payable - Period ${period.name}`,
              },
              {
                tenantId,
                accountId: deductionsAcc.id,
                debit: new Prisma.Decimal(0),
                credit: totalWithholdings,
                description: `Payroll Withholdings & Deductions - Period ${period.name}`,
              },
            ],
          },
        },
      });

      // Update GL Account balances
      // Expense increases on Debit
      await tx.account.update({
        where: { id: expenseAcc.id },
        data: {
          balance: expenseAcc.balance.add(totalGross),
          version: expenseAcc.version + 1,
        },
      });

      // Liability increases on Credit
      await tx.account.update({
        where: { id: payableAcc.id },
        data: {
          balance: payableAcc.balance.add(totalNet),
          version: payableAcc.version + 1,
        },
      });

      await tx.account.update({
        where: { id: deductionsAcc.id },
        data: {
          balance: deductionsAcc.balance.add(totalWithholdings),
          version: deductionsAcc.version + 1,
        },
      });

      // Lock the period
      const updatedPeriod = await tx.payrollPeriod.update({
        where: { id },
        data: {
          status: PayrollPeriodStatus.LOCKED,
          journalEntryId: journal.id,
          version: period.version + 1,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          entity: "PayrollPeriod",
          entityId: period.id,
          action: "PAYROLL_LOCKED",
          newValues: updatedPeriod,
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: "Payroll Period Locked",
        message: `Payroll period ${period.name} has been locked and GL postings completed.`,
        type: NotificationType.INFO,
      });

      return updatedPeriod;
    });
  }

  // --- QUERY PAYSLIPS ---
  async getPayslips(query: QueryPayrollDto, user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const where: Prisma.PayslipWhereInput = {
      tenantId,
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.payrollPeriodId && { payrollPeriodId: query.payrollPeriodId }),
    };

    const data = await this.prisma.payslip.findMany({
      where,
      include: {
        employee: true,
        payrollPeriod: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (query.export === "csv") {
      let csv =
        "Employee Code,Employee Name,Base Salary,Earnings,Overtime Pay,Deductions,LWP Deduction,Net Pay,Status\n";
      for (const p of data) {
        csv += `"${p.employee.employeeCode}","${p.employee.firstName} ${p.employee.lastName}",${p.baseSalary},${p.earnings},${p.overtimePay},${p.deductions},${p.lwpDeduction},${p.netPay},"${p.status}"\n`;
      }
      return { csv };
    }

    return data;
  }

  // --- PDF GENERATION ---
  async exportPayslipPdf(id: string, user: AuthUser): Promise<Buffer> {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const payslip = await this.prisma.payslip.findFirst({
      where: { id, tenantId },
      include: { employee: true, payrollPeriod: true },
    });
    if (!payslip) {
      throw new NotFoundException(`Payslip ${id} not found.`);
    }

    // Manually format a valid PDF structure buffer
    const lines = [
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
      `<< /Length 500 >>`,
      "stream",
      "BT",
      "/F1 12 Tf",
      "72 712 Td",
      `(PAYSLIP - ${payslip.payrollPeriod.name}) Tj`,
      "0 -20 Td",
      `(Employee Name: ${payslip.employee.firstName} ${payslip.employee.lastName}) Tj`,
      "0 -20 Td",
      `(Employee Code: ${payslip.employee.employeeCode}) Tj`,
      "0 -20 Td",
      `(Base Salary: ${payslip.baseSalary.toString()}) Tj`,
      "0 -20 Td",
      `(Earnings Additions: ${payslip.earnings.toString()}) Tj`,
      "0 -20 Td",
      `(Overtime Pay: ${payslip.overtimePay.toString()}) Tj`,
      "0 -20 Td",
      `(Deductions Withheld: ${payslip.deductions.toString()}) Tj`,
      "0 -20 Td",
      `(LWP Deduction: ${payslip.lwpDeduction.toString()}) Tj`,
      "0 -20 Td",
      `(Net Take-Home Pay: ${payslip.netPay.toString()}) Tj`,
      "ET",
      "endstream",
      "endobj",
      "xref",
      "0 5",
      "0000000000 65535 f",
      "0000000009 00000 n",
      "0000000058 00000 n",
      "0000000115 00000 n",
      "0000000282 00000 n",
      "trailer",
      "<< /Size 5 /Root 1 0 R >>",
      "startxref",
      "800",
      "%%EOF",
    ];

    const pdfBuffer = Buffer.from(lines.join("\n"), "utf-8");

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        entity: "Payslip",
        entityId: payslip.id,
        action: "PAYSLIP_GENERATED",
        newValues: { pdfExport: true },
      },
    });

    return pdfBuffer;
  }

  // --- DASHBOARD SUMMARY ---
  async getDashboardSummary(user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException("Tenant ID is required.");
    }
    const tenantId = user.tenantId;

    const lockedPeriods = await this.prisma.payrollPeriod.findMany({
      where: { tenantId, status: PayrollPeriodStatus.LOCKED },
      include: { payslips: true },
      orderBy: { endDate: "desc" },
      take: 1,
    });

    if (lockedPeriods.length === 0) {
      return {
        totalPayrollCost: 0,
        totalNetDisbursed: 0,
        averageSalary: 0,
      };
    }

    const latest = lockedPeriods[0];
    let totalGross = new Prisma.Decimal(0);
    let totalNet = new Prisma.Decimal(0);

    for (const p of latest.payslips) {
      totalGross = totalGross
        .add(p.baseSalary)
        .add(p.earnings)
        .add(p.overtimePay);
      totalNet = totalNet.add(p.netPay);
    }

    const count = latest.payslips.length;
    const avg = count > 0 ? totalGross.div(count).toNumber() : 0;

    return {
      totalPayrollCost: totalGross.toNumber(),
      totalNetDisbursed: totalNet.toNumber(),
      averageSalary: avg,
    };
  }
}
