import { IsOptional, IsString, IsUUID } from "class-validator";

export class QueryPayrollDto {
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsUUID()
  @IsOptional()
  payrollPeriodId?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
