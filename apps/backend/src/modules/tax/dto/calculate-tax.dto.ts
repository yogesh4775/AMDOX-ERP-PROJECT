import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CalculateTaxItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsNotEmpty()
  taxCategoryId!: string;

  @IsNumber()
  @IsNotEmpty()
  baseAmount!: number;
}

export class CalculateTaxDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  jurisdiction?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CalculateTaxItemDto)
  items!: CalculateTaxItemDto[];
}
