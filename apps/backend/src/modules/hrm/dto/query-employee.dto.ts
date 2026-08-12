import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { EmployeeStatus } from "@amdox/database/generated";

export class QueryEmployeeDto {
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
