import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";
import { StockTransferLineDto } from "./create-transfer.dto";

export class UpdateStockTransferDto {
  @IsUUID()
  @IsOptional()
  fromWarehouseId?: string;

  @IsUUID()
  @IsOptional()
  toWarehouseId?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDto)
  lines?: StockTransferLineDto[];

  @IsInt()
  expectedVersion!: number;
}
