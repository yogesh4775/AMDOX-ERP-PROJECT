import { IsOptional, IsString, IsUUID } from "class-validator";

export class QueryAttendanceDto {
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsString()
  @IsOptional()
  date?: string; // YYYY-MM-DD format

  @IsString()
  @IsOptional()
  export?: string;
}
