import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { EmploymentType, EmployeeStatus } from "@amdox/database/generated";

export class UpdateEmployeeDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  designationId?: string;

  @IsUUID()
  @IsOptional()
  reportingManagerId?: string;

  @IsEnum(EmploymentType)
  @IsOptional()
  employmentType?: EmploymentType;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsDateString()
  @IsOptional()
  confirmationDate?: string;

  @IsDateString()
  @IsOptional()
  separationDate?: string;

  @IsString()
  @IsOptional()
  separationReason?: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
