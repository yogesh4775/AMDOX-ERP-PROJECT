import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  IsDateString,
} from "class-validator";
import { Type } from "class-transformer";

export class PurchaseOrderItemDto {
  @IsUUID("4", { message: "productId must be a valid UUID" })
  @IsNotEmpty({ message: "productId is required" })
  productId!: string;

  @IsNumber({}, { message: "quantity must be a number" })
  @Min(0.0001, { message: "quantity must be greater than 0" })
  quantity!: number;

  @IsNumber({}, { message: "unitPrice must be a number" })
  @Min(0.0, { message: "unitPrice must be greater than or equal to 0" })
  unitPrice!: number;
}

export class CreatePurchaseOrderDto {
  @IsString({ message: "supplierName must be a string" })
  @IsNotEmpty({ message: "supplierName is required" })
  supplierName!: string;

  @IsDateString(
    {},
    { message: "expectedDeliveryDate must be a valid ISO date" },
  )
  @IsNotEmpty({ message: "expectedDeliveryDate is required" })
  expectedDeliveryDate!: string;

  @IsString({ message: "notes must be a string" })
  @IsOptional()
  notes?: string;

  @IsArray({ message: "items must be an array" })
  @IsNotEmpty({ message: "items cannot be empty" })
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}
