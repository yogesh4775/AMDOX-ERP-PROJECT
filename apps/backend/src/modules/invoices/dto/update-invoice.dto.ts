import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsDateString,
  IsEnum,
  IsUUID,
  IsInt,
} from "class-validator";
import { Type } from "class-transformer";
import { InvoiceType } from "@amdox/database/generated";
import { InvoiceItemDto } from "./create-invoice.dto";

export class UpdateInvoiceDto {
  @IsEnum(InvoiceType, { message: "type must be a valid InvoiceType value" })
  @IsOptional()
  type?: InvoiceType;

  @IsUUID("4", { message: "customerId must be a valid UUID" })
  @IsOptional()
  customerId?: string;

  @IsString({ message: "supplierName must be a string" })
  @IsOptional()
  supplierName?: string;

  @IsDateString({}, { message: "invoiceDate must be a valid ISO date" })
  @IsOptional()
  invoiceDate?: string;

  @IsDateString({}, { message: "dueDate must be a valid ISO date" })
  @IsOptional()
  dueDate?: string;

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
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsInt({ message: "expectedVersion must be an integer" })
  @Min(1, { message: "expectedVersion must be at least 1" })
  expectedVersion!: number;
}
