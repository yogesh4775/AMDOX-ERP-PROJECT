import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { StockAdjustmentType } from "@amdox/database/generated";

export class StockAdjustmentLineDto {
  @IsUUID()
  productId!: string;

  @IsEnum(StockAdjustmentType)
  type!: StockAdjustmentType;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CreateStockAdjustmentDto {
  @IsUUID()
  warehouseId!: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentLineDto)
  lines!: StockAdjustmentLineDto[];
}
