import { IsOptional, IsString, IsEnum } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { InvoiceType, InvoiceStatus } from "@amdox/database/generated";

export class QueryInvoiceDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(InvoiceType, { message: "type must be a valid InvoiceType value" })
  type?: InvoiceType;

  @IsOptional()
  @IsEnum(InvoiceStatus, {
    message: "status must be a valid InvoiceStatus value",
  })
  status?: InvoiceStatus;

  @IsOptional()
  @IsString({ message: "invoiceNumber must be a string" })
  invoiceNumber?: string;
}
