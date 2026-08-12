import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";

export class PurchaseReceiptItemDto {
  @IsUUID("4", { message: "productId must be a valid UUID" })
  @IsNotEmpty({ message: "productId is required" })
  productId!: string;

  @IsNumber({}, { message: "quantityReceived must be a number" })
  @Min(0.0001, { message: "quantityReceived must be greater than 0" })
  quantityReceived!: number;
}

export class ReceivePurchaseOrderDto {
  @IsUUID("4", { message: "warehouseId must be a valid UUID" })
  @IsNotEmpty({ message: "warehouseId is required" })
  warehouseId!: string;

  @IsString({ message: "remarks must be a string" })
  @IsOptional()
  remarks?: string;

  @IsInt({ message: "expectedVersion must be an integer" })
  @Min(1, { message: "expectedVersion must be at least 1" })
  expectedVersion!: number;

  @IsArray({ message: "items must be an array" })
  @IsNotEmpty({ message: "items cannot be empty" })
  @ValidateNested({ each: true })
  @Type(() => PurchaseReceiptItemDto)
  items!: PurchaseReceiptItemDto[];
}
