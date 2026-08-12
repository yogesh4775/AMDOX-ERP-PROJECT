import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsUUID,
  IsNumber,
  Min,
} from "class-validator";
import { MasterStatus } from "@amdox/database/generated";

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(100)
  sku!: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  barcode?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  categoryId!: string;

  @IsUUID()
  unitId!: string;

  @IsUUID()
  @IsOptional()
  taxCategoryId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  costPrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderLevel?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderQuantity?: number;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;
}
