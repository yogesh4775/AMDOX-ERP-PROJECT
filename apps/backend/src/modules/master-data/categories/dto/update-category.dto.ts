import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsInt,
  IsUUID,
} from "class-validator";
import { MasterStatus } from "@amdox/database/generated";

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsOptional()
  @IsUUID()
  parentCategoryId?: string;

  @IsInt()
  expectedVersion!: number;
}
