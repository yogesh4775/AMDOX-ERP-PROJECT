import {
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsPositive,
  IsUUID,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export enum PaymentType {
  RECEIPT = "RECEIPT",
  DISBURSEMENT = "DISBURSEMENT",
}

export enum PaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  CHECK = "CHECK",
  CREDIT_CARD = "CREDIT_CARD",
  OTHER = "OTHER",
}

export class PaymentAllocationInputDto {
  @IsUUID()
  invoiceId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  allocatedAmount!: number;
}

export class CreatePaymentDto {
  @IsEnum(PaymentType)
  type!: PaymentType;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsDateString()
  paymentDate!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  supplierName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  @IsOptional()
  allocations?: PaymentAllocationInputDto[];
}
