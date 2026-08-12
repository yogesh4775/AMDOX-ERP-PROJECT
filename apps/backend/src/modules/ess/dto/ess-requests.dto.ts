import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class EssRequestLeaveDto {
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsBoolean()
  @IsOptional()
  isHalfDay?: boolean;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class EssCreateClaimItemDto {
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class EssCreateClaimDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsDateString()
  @IsNotEmpty()
  claimDate!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EssCreateClaimItemDto)
  @IsNotEmpty()
  items!: EssCreateClaimItemDto[];
}
