import { IsOptional, IsString, IsUUID } from "class-validator";

export class QueryLeaveDto {
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
