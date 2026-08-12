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

export class SalesOrderItemDto {
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

export class CreateSalesOrderDto {
  @IsUUID("4", { message: "customerId must be a valid UUID" })
  @IsNotEmpty({ message: "customerId is required" })
  customerId!: string;

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
  @Type(() => SalesOrderItemDto)
  items!: SalesOrderItemDto[];
}
