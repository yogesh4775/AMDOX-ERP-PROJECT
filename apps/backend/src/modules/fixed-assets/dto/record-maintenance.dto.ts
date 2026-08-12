import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class RecordMaintenanceDto {
  @IsDateString()
  @IsNotEmpty()
  maintenanceDate!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  cost!: number;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsBoolean()
  @IsNotEmpty()
  isCapitalized!: boolean;

  @IsUUID()
  @IsNotEmpty()
  creditAccountId!: string; // Cash/Bank/AP account

  @IsUUID()
  @IsOptional()
  expenseAccountId?: string; // required if isCapitalized is false

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
