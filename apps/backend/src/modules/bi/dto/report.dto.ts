/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsNumber,
  Min,
  IsUUID,
  IsBoolean,
  IsEmail,
} from "class-validator";

export class CreateReportDefinitionDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsString()
  module!: string;

  @IsNotEmpty()
  @IsObject()
  config!: Record<string, any>;
}

export class UpdateReportDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  expectedVersion!: number;
}

export class CreateReportScheduleDto {
  @IsNotEmpty()
  @IsUUID()
  reportDefinitionId!: string;

  @IsNotEmpty()
  @IsEmail()
  recipientEmail!: string;

  @IsNotEmpty()
  @IsString()
  cronExpression!: string;

  @IsNotEmpty()
  @IsString()
  format!: string; // "PDF" | "CSV" | "EXCEL"
}

export class UpdateReportScheduleDto {
  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsString()
  cronExpression?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  expectedVersion!: number;
}
