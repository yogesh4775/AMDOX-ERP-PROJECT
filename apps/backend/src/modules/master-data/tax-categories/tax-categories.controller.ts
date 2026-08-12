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
import { TaxCategoriesService } from "./tax-categories.service";
import { CreateTaxCategoryDto } from "./dto/create-tax-category.dto";
import { UpdateTaxCategoryDto } from "./dto/update-tax-category.dto";
import { QueryTaxCategoryDto } from "./dto/query-tax-category.dto";
import { DeleteTaxCategoryDto } from "./dto/delete-tax-category.dto";
import { RestoreTaxCategoryDto } from "./dto/restore-tax-category.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("master-data/tax-categories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TaxCategoriesController {
  constructor(private readonly taxCategoriesService: TaxCategoriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.TAX_CATEGORY_CREATE)
  async create(
    @Body() dto: CreateTaxCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxCategoriesService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.TAX_CATEGORY_READ)
  async findAll(
    @Query() query: QueryTaxCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxCategoriesService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.TAX_CATEGORY_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxCategoriesService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.TAX_CATEGORY_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaxCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxCategoriesService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.TAX_CATEGORY_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteTaxCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxCategoriesService.delete(id, dto, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.TAX_CATEGORY_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreTaxCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.taxCategoriesService.restore(id, dto, req.user);
  }
}
