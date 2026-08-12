import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { CreateInvoiceDto } from "./dto/create-invoice.dto";
import { UpdateInvoiceDto } from "./dto/update-invoice.dto";
import { IssueInvoiceDto } from "./dto/issue-invoice.dto";
import { PayInvoiceDto } from "./dto/pay-invoice.dto";
import { CancelInvoiceDto } from "./dto/cancel-invoice.dto";
import { GenerateInvoiceDto } from "./dto/generate-invoice.dto";
import { QueryInvoiceDto } from "./dto/query-invoice.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("invoices")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.INVOICE_CREATE)
  async create(@Body() dto: CreateInvoiceDto, @Req() req: { user: AuthUser }) {
    return this.invoicesService.create(dto, req.user);
  }

  @Post("generate")
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.INVOICE_CREATE)
  async generateFromSource(
    @Body() dto: GenerateInvoiceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.invoicesService.generateFromSource(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.INVOICE_READ)
  async findAll(
    @Query() query: QueryInvoiceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.invoicesService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.INVOICE_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.invoicesService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.INVOICE_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateInvoiceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.invoicesService.update(id, dto, req.user);
  }

  @Patch(":id/issue")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.INVOICE_ISSUE)
  async issue(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: IssueInvoiceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.invoicesService.issue(id, dto, req.user);
  }

  @Patch(":id/pay")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.INVOICE_PAY)
  async recordPayment(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PayInvoiceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.invoicesService.recordPayment(id, dto, req.user);
  }

  @Patch(":id/cancel")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.INVOICE_CANCEL)
  async cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelInvoiceDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.invoicesService.cancel(id, dto, req.user);
  }
}
