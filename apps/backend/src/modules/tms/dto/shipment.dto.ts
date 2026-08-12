import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  ShipmentSourceType,
  StopType,
  ExceptionType,
} from "@amdox/database/generated";

export class CreateShipmentStopDto {
  @IsNumber()
  @IsNotEmpty()
  sequence!: number;

  @IsEnum(StopType)
  @IsNotEmpty()
  stopType!: StopType;

  @IsString()
  @IsNotEmpty()
  address!: string;

  @IsString()
  @IsNotEmpty()
  estimatedTime!: string; // ISO date string
}

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsEnum(ShipmentSourceType)
  @IsNotEmpty()
  sourceType!: ShipmentSourceType;

  @IsString()
  @IsOptional()
  salesOrderId?: string;

  @IsString()
  @IsOptional()
  purchaseOrderId?: string;

  @IsNumber()
  @IsOptional()
  totalWeight?: number;

  @IsNumber()
  @IsOptional()
  totalVolume?: number;

  @IsNumber()
  @IsOptional()
  freightCost?: number;

  @IsString()
  @IsOptional()
  carrierId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentStopDto)
  stops!: CreateShipmentStopDto[];
}

export class RecordPODDto {
  @IsString()
  @IsNotEmpty()
  signature!: string;

  @IsString()
  @IsNotEmpty()
  signedByName!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class LogExceptionDto {
  @IsEnum(ExceptionType)
  @IsNotEmpty()
  type!: ExceptionType;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  stopId?: string;
}
