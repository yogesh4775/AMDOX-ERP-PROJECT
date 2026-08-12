import { IsOptional, IsString, IsUUID } from "class-validator";

export class QueryPmsDto {
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsUUID()
  @IsOptional()
  appraisalCycleId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
