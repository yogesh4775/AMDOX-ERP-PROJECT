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
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { InvoiceType } from "@amdox/database/generated";

export class InvoiceItemDto {
  @IsUUID("4", { message: "productId must be a valid UUID" })
  @IsNotEmpty({ message: "productId is required" })
  productId!: string;

  @IsNumber({}, { message: "quantity must be a number" })
  @Min(0.0001, { message: "quantity must be greater than 0" })
  quantity!: number;

  @IsNumber({}, { message: "unitPrice must be a number" })
  @Min(0.0, { message: "unitPrice must be greater than or equal to 0" })
  unitPrice!: number;

  @IsNumber({}, { message: "discountAmount must be a number" })
  @Min(0.0, { message: "discountAmount must be greater than or equal to 0" })
  @IsOptional()
  discountAmount?: number;
}

export class CreateInvoiceDto {
  @IsEnum(InvoiceType, { message: "type must be a valid InvoiceType value" })
  @IsNotEmpty({ message: "type is required" })
  type!: InvoiceType;

  @IsUUID("4", { message: "customerId must be a valid UUID" })
  @IsOptional()
  customerId?: string;

  @IsString({ message: "supplierName must be a string" })
  @IsOptional()
  supplierName?: string;

  @IsDateString({}, { message: "invoiceDate must be a valid ISO date" })
  @IsNotEmpty({ message: "invoiceDate is required" })
  invoiceDate!: string;

  @IsDateString({}, { message: "dueDate must be a valid ISO date" })
  @IsNotEmpty({ message: "dueDate is required" })
  dueDate!: string;

  @IsString({ message: "currency must be a string" })
  @IsOptional()
  currency?: string;

  @IsString({ message: "referenceType must be a string" })
  @IsOptional()
  referenceType?: string;

  @IsUUID("4", { message: "referenceId must be a valid UUID" })
  @IsOptional()
  referenceId?: string;

  @IsArray({ message: "items must be an array" })
  @IsNotEmpty({ message: "items cannot be empty" })
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];
}
