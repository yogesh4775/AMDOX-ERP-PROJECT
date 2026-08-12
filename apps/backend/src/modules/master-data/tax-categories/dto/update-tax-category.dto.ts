import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsInt,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from "class-validator";
import { MasterStatus } from "@amdox/database/generated";

export class UpdateTaxCategoryDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsInt()
  expectedVersion!: number;
}
