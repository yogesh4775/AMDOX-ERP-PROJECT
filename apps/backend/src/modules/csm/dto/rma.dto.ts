import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { RmaStatus } from "@amdox/database/generated";

export class CreateRmaDto {
  @IsUUID()
  @IsOptional()
  ticketId?: string;

  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsOptional()
  contractId?: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  actionType!: string; // REFUND, REPLACE, REPAIR

  @IsNumber()
  @Min(0)
  @IsOptional()
  refundAmount?: number;
}

export class UpdateRmaStatusDto {
  @IsEnum(RmaStatus)
  @IsNotEmpty()
  status!: RmaStatus;

  @IsUUID()
  @IsOptional()
  warehouseBinId?: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
