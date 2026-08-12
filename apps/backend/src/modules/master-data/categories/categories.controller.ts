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
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { QueryCategoryDto } from "./dto/query-category.dto";
import { DeleteCategoryDto } from "./dto/delete-category.dto";
import { RestoreCategoryDto } from "./dto/restore-category.dto";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../../auth/guards/permissions.guard";
import { Permissions } from "../../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../../common/constants/permissions.constants";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";

@Controller("master-data/categories")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.CATEGORY_CREATE)
  async create(@Body() dto: CreateCategoryDto, @Req() req: { user: AuthUser }) {
    return this.categoriesService.create(dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.CATEGORY_READ)
  async findAll(
    @Query() query: QueryCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.categoriesService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.CATEGORY_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.categoriesService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.CATEGORY_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.categoriesService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.CATEGORY_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.categoriesService.delete(id, dto, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.CATEGORY_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreCategoryDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.categoriesService.restore(id, dto, req.user);
  }
}
