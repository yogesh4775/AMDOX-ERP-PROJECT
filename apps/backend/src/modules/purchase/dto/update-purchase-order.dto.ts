import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsDateString,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";
import { PurchaseOrderItemDto } from "./create-purchase-order.dto";

export class UpdatePurchaseOrderDto {
  @IsString({ message: "supplierName must be a string" })
  @IsOptional()
  supplierName?: string;

  @IsDateString(
    {},
    { message: "expectedDeliveryDate must be a valid ISO date" },
  )
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString({ message: "notes must be a string" })
  @IsOptional()
  notes?: string;

  @IsArray({ message: "items must be an array" })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items?: PurchaseOrderItemDto[];

  @IsInt({ message: "expectedVersion must be an integer" })
  @Min(1, { message: "expectedVersion must be at least 1" })
  expectedVersion!: number;
}
