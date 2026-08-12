import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { QueryCustomerDto } from "./dto/query-customer.dto";
import { DeleteCustomerDto } from "./dto/delete-customer.dto";
import { RestoreCustomerDto } from "./dto/restore-customer.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("sales/customers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.CUSTOMER_CREATE)
  async create(@Body() dto: CreateCustomerDto, @Req() req: { user: AuthUser }) {
    return this.customersService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.CUSTOMER_READ)
  async findAll(
    @Query() query: QueryCustomerDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.customersService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.CUSTOMER_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.customersService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.CUSTOMER_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.customersService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.CUSTOMER_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteCustomerDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.customersService.delete(id, dto.expectedVersion, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.CUSTOMER_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreCustomerDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.customersService.restore(id, dto.expectedVersion, req.user);
  }
}
