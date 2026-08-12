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
  Res,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { MediaService } from "./media.service";
import { CreateMediaDto } from "./dto/create-media.dto";
import { QueryMediaDto } from "./dto/query-media.dto";
import { UpdateMediaDto } from "./dto/update-media.dto";
import { DeleteMediaDto } from "./dto/delete-media.dto";
import { RestoreMediaDto } from "./dto/restore-media.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { MulterFile } from "./storage/storage-provider.interface";

@Controller("media")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(PermissionsList.MEDIA_CREATE)
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: MulterFile,
    @Body() dto: CreateMediaDto,
    @Req() req: { user: AuthUser },
  ) {
    if (!file) {
      throw new BadRequestException("No file uploaded.");
    }
    return this.mediaService.upload(file, dto, req.user);
  }

  @Get()
  @Permissions(PermissionsList.MEDIA_READ)
  async findAll(@Query() query: QueryMediaDto, @Req() req: { user: AuthUser }) {
    return this.mediaService.findAll(query, req.user);
  }

  @Get(":id")
  @Permissions(PermissionsList.MEDIA_READ)
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
  ) {
    return this.mediaService.findOne(id, req.user);
  }

  @Patch(":id")
  @Permissions(PermissionsList.MEDIA_UPDATE)
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMediaDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.mediaService.update(id, dto, req.user);
  }

  @Delete(":id")
  @Permissions(PermissionsList.MEDIA_DELETE)
  async delete(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DeleteMediaDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.mediaService.delete(id, dto, req.user);
  }

  @Post(":id/restore")
  @HttpCode(HttpStatus.OK)
  @Permissions(PermissionsList.MEDIA_RESTORE)
  async restore(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RestoreMediaDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.mediaService.restore(id, dto, req.user);
  }

  @Get(":id/download")
  @Permissions(PermissionsList.MEDIA_READ)
  async download(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: { user: AuthUser },
    @Res() res: Response,
  ) {
    const { stream, originalName, mimeType, size } =
      await this.mediaService.getDownloadStream(id, req.user);

    res.setHeader("Content-Type", mimeType);
    // Use encodeURIComponent to handle non-ASCII filenames safely
    const safeFilename = encodeURIComponent(originalName);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
    );
    res.setHeader("Content-Length", size.toString());

    stream.pipe(res);
  }
}
