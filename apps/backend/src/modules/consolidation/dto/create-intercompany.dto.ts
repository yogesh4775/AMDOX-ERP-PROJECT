import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  IsEnum,
} from "class-validator";
import { InterCompanyType } from "@amdox/database";

export class CreateInterCompanyDto {
  @IsNotEmpty()
  @IsUUID()
  fromCompanyId!: string;

  @IsNotEmpty()
  @IsUUID()
  toCompanyId!: string;

  @IsNotEmpty()
  @IsEnum(InterCompanyType)
  type!: InterCompanyType;

  @IsNotEmpty()
  @IsNumber()
  amount!: number;

  @IsNotEmpty()
  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @IsOptional()
  @IsNumber()
  transferPricingMarkup?: number;
}
