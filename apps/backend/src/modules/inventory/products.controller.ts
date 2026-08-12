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
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { QueryProductDto } from "./dto/query-product.dto";
import { DeleteProductDto } from "./dto/delete-product.dto";
import { RestoreProductDto } from "./dto/restore-product.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";

@Controller("inventory/products")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.PRODUCT_CREATE)
  async create(@Body() dto: CreateProductDto, @Req() req: { user: AuthUser }) {
    return this.productsService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.PRODUCT_READ)
  async findAll(
    @Query() query: QueryProductDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.productsService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.PRODUCT_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.productsService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.PRODUCT_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.productsService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.PRODUCT_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteProductDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.productsService.delete(id, dto.expectedVersion, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.PRODUCT_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreProductDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.productsService.restore(id, dto.expectedVersion, req.user);
  }
}
