import {
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { ServiceVisitStatus } from "@amdox/database/generated";

export class CreateServiceVisitDto {
  @IsUUID()
  @IsNotEmpty()
  ticketId!: string;

  @IsUUID()
  @IsNotEmpty()
  technicianId!: string;

  @IsUUID()
  @IsOptional()
  vehicleId?: string;

  @IsUUID()
  @IsOptional()
  driverId?: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledAt!: string;
}

export class UpdateServiceVisitStatusDto {
  @IsEnum(ServiceVisitStatus)
  @IsNotEmpty()
  status!: ServiceVisitStatus;

  @IsString()
  @IsOptional()
  resolutionNotes?: string;

  @IsLatitude()
  @IsOptional()
  latitude?: number;

  @IsLongitude()
  @IsOptional()
  longitude?: number;
}
