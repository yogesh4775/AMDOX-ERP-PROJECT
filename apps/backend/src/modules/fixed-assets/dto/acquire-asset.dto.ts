import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
} from "class-validator";
import { DepreciationMethod } from "@amdox/database/generated";

export class AcquireAssetDto {
  @IsUUID()
  @IsNotEmpty()
  assetCategoryId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  purchaseDate!: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  purchaseCost!: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  salvageValue!: number;

  @IsInt()
  @Min(1)
  @IsNotEmpty()
  usefulLife!: number; // in months

  @IsEnum(DepreciationMethod)
  @IsNotEmpty()
  depreciationMethod!: DepreciationMethod;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  depreciationRate?: number; // percentage rate for declining balance

  @IsUUID()
  @IsNotEmpty()
  creditAccountId!: string; // Cash/Bank or AP account

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  department?: string;
}
