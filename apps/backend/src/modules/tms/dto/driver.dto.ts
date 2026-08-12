import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";
import { DriverStatus } from "@amdox/database/generated";

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  licenseNumber!: string;

  @IsString()
  @IsNotEmpty()
  contactPhone!: string;
}

export class UpdateDriverDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;

  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus;
}
