import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @IsNumber()
  @Min(0.01)
  maxDaysPerYear!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  accrualRateMonthly?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxCarryForward?: number;

  @IsBoolean()
  @IsOptional()
  isSandwichRuleEnabled?: boolean;

  // Policy parameters
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxConsecutiveDays?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minNoticePeriodDays?: number;

  @IsBoolean()
  @IsOptional()
  probationRestricted?: boolean;

  @IsBoolean()
  @IsOptional()
  noticePeriodRestricted?: boolean;
}
