import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";
import { StockAdjustmentLineDto } from "./create-adjustment.dto";

export class UpdateStockAdjustmentDto {
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentLineDto)
  lines?: StockAdjustmentLineDto[];

  @IsInt()
  expectedVersion!: number;
}
