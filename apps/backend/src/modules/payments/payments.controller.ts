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
import { PaymentsService } from "./payments.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { PostPaymentDto } from "./dto/post-payment.dto";
import { ReversePaymentDto } from "./dto/reverse-payment.dto";
import { QueryPaymentDto } from "./dto/query-payment.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("payments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.PAYMENT_CREATE)
  async create(@Body() dto: CreatePaymentDto, @Req() req: { user: AuthUser }) {
    return this.paymentsService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.PAYMENT_READ)
  async findAll(
    @Query() query: QueryPaymentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.paymentsService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.PAYMENT_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.paymentsService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.PAYMENT_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.paymentsService.update(id, dto, req.user);
  }

  @Patch(":id/post")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.PAYMENT_POST)
  async post(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PostPaymentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.paymentsService.post(id, dto, req.user);
  }

  @Patch(":id/reverse")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.PAYMENT_REVERSE)
  async reverse(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReversePaymentDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.paymentsService.reverse(id, dto, req.user);
  }
}
