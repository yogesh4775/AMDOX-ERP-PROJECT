import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
} from "class-validator";
import { MaintenanceType } from "@amdox/database/generated";

export class CreateTripDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsOptional()
  vehicleId?: string;

  @IsString()
  @IsOptional()
  driverId?: string;

  @IsString()
  @IsOptional()
  carrierId?: string;

  @IsArray()
  @IsString({ each: true })
  shipmentIds!: string[];

  @IsNumber()
  @IsNotEmpty()
  estimatedDistance!: number;

  @IsNumber()
  @IsNotEmpty()
  estimatedDuration!: number; // in minutes

  @IsString()
  @IsOptional()
  routePath?: string;
}

export class DispatchTripDto {
  @IsNumber()
  @IsOptional()
  startOdometer?: number;
}

export class CompleteTripDto {
  @IsNumber()
  @IsOptional()
  endOdometer?: number;
}

export class LogGPSDto {
  @IsNumber()
  @IsNotEmpty()
  latitude!: number;

  @IsNumber()
  @IsNotEmpty()
  longitude!: number;
}

export class LogFuelDto {
  @IsString()
  @IsNotEmpty()
  logDate!: string; // ISO date string

  @IsNumber()
  @IsNotEmpty()
  fuelAmount!: number;

  @IsNumber()
  @IsNotEmpty()
  costPerLiter!: number;

  @IsNumber()
  @IsNotEmpty()
  totalCost!: number;

  @IsNumber()
  @IsNotEmpty()
  odometer!: number;
}

export class ScheduleMaintenanceDto {
  @IsEnum(MaintenanceType)
  @IsNotEmpty()
  type!: MaintenanceType;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  scheduledDate!: string; // ISO date string
}
