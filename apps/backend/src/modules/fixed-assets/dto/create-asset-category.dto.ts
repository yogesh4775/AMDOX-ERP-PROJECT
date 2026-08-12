import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { DepreciationMethod } from "@amdox/database/generated";

export class CreateAssetCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DepreciationMethod)
  @IsNotEmpty()
  depreciationMethod!: DepreciationMethod;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  usefulLife!: number; // in months

  @IsUUID()
  @IsNotEmpty()
  assetAccountId!: string;

  @IsUUID()
  @IsNotEmpty()
  accumulatedDepreciationAccountId!: string;

  @IsUUID()
  @IsNotEmpty()
  depreciationExpenseAccountId!: string;
}
