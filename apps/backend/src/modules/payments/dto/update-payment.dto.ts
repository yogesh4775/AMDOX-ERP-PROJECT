import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
  IsPositive,
  IsUUID,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  PaymentType,
  PaymentMethod,
  PaymentAllocationInputDto,
} from "./create-payment.dto";

export class UpdatePaymentDto {
  @IsEnum(PaymentType)
  @IsOptional()
  type?: PaymentType;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @IsString()
  @IsOptional()
  referenceNumber?: string;

  @IsDateString()
  @IsOptional()
  paymentDate?: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @IsOptional()
  amount?: number;

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

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
