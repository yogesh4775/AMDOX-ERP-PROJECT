import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
} from "class-validator";
import { VehicleStatus } from "@amdox/database/generated";

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  licensePlate!: string;

  @IsString()
  @IsNotEmpty()
  model!: string;

  @IsNumber()
  @IsNotEmpty()
  capacityWeight!: number;

  @IsNumber()
  @IsNotEmpty()
  capacityVolume!: number;

  @IsNumber()
  @IsNotEmpty()
  fuelEfficiency!: number;
}

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @IsOptional()
  capacityWeight?: number;

  @IsNumber()
  @IsOptional()
  capacityVolume?: number;

  @IsNumber()
  @IsOptional()
  fuelEfficiency?: number;

  @IsEnum(VehicleStatus)
  @IsOptional()
  status?: VehicleStatus;
}
