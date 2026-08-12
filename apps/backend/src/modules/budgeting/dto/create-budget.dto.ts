import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BudgetPeriodType } from "@amdox/database/generated";

export class CreateBudgetItemDto {
  @IsUUID()
  @IsNotEmpty()
  glAccountId!: string;

  @IsString()
  @IsNotEmpty()
  category!: string; // Revenue, Expense, CapEx

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;

  @IsDateString()
  @IsNotEmpty()
  periodStart!: string;

  @IsDateString()
  @IsNotEmpty()
  periodEnd!: string;
}

export class CreateBudgetDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @IsNotEmpty()
  fiscalYear!: number;

  @IsEnum(BudgetPeriodType)
  @IsNotEmpty()
  periodType!: BudgetPeriodType;

  @IsInt()
  @IsOptional()
  versionNumber?: number;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  costCenter?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetItemDto)
  items!: CreateBudgetItemDto[];
}
