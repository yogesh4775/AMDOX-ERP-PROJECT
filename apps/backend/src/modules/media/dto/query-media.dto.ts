import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsDateString,
} from "class-validator";
import { Transform } from "class-transformer";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { MediaFileType } from "@amdox/database/generated";

export { MediaFileType };

export class QueryMediaDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  filename?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsEnum(MediaFileType)
  type?: MediaFileType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  includeDeleted?: boolean;
}
