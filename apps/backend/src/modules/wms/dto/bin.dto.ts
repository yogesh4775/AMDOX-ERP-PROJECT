import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
} from "class-validator";
import { BinStatus } from "@amdox/database/generated";

export class CreateWarehouseBinDto {
  @IsUUID()
  @IsNotEmpty()
  zoneId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  aisle?: string;

  @IsString()
  @IsOptional()
  rack?: string;

  @IsString()
  @IsOptional()
  shelf?: string;

  @IsString()
  @IsOptional()
  position?: string;

  @IsNumber()
  @IsOptional()
  maxVolume?: number;

  @IsNumber()
  @IsOptional()
  maxWeight?: number;
}

export class UpdateWarehouseBinDto {
  @IsEnum(BinStatus)
  @IsOptional()
  status?: BinStatus;

  @IsNumber()
  @IsOptional()
  maxVolume?: number;

  @IsNumber()
  @IsOptional()
  maxWeight?: number;

  @IsOptional()
  expectedVersion?: number;
}
