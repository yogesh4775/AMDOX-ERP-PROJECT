import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ExemptionEntityType } from "@amdox/database/generated";

export class CreateTaxExemptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEnum(ExemptionEntityType)
  @IsNotEmpty()
  entityType!: ExemptionEntityType;

  @IsUUID()
  @IsNotEmpty()
  entityId!: string;

  @IsUUID()
  @IsNotEmpty()
  taxRuleId!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
