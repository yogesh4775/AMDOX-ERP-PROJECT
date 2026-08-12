import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class StatementLineDto {
  @IsDateString()
  @IsNotEmpty()
  statementLineDate!: string;

  @IsString()
  @IsNotEmpty()
  statementLineRef!: string;

  @IsNumber()
  @IsNotEmpty()
  statementLineAmount!: number;
}

export class CreateReconciliationDto {
  @IsUUID()
  @IsNotEmpty()
  bankAccountId!: string;

  @IsString()
  @IsNotEmpty()
  statementNumber!: string;

  @IsDateString()
  @IsNotEmpty()
  statementDate!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsNumber()
  @IsNotEmpty()
  openingBalance!: number;

  @IsNumber()
  @IsNotEmpty()
  closingBalance!: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StatementLineDto)
  statementLines?: StatementLineDto[];
}
