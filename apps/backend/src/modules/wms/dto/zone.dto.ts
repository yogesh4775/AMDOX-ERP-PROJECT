import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsUUID,
} from "class-validator";

export class CreateWarehouseZoneDto {
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isHazardous?: boolean;

  @IsString()
  @IsOptional()
  temperatureClass?: string;
}

export class UpdateWarehouseZoneDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isHazardous?: boolean;

  @IsString()
  @IsOptional()
  temperatureClass?: string;

  @IsOptional()
  expectedVersion?: number;
}
