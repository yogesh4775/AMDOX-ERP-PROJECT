import { IsOptional, IsEnum, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { PaymentType } from "./create-payment.dto";

export enum PaymentStatus {
  DRAFT = "DRAFT",
  POSTED = "POSTED",
  REVERSED = "REVERSED",
}

export class QueryPaymentDto extends PaginationQueryDto {
  @IsEnum(PaymentType)
  @IsOptional()
  type?: PaymentType;

  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @IsString()
  @IsOptional()
  paymentNumber?: string;
}
