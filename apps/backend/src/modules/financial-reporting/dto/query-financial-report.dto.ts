import { IsDateString, IsOptional, IsString, IsUUID } from "class-validator";

export class QueryFinancialReportDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  periodId?: string;

  @IsUUID()
  @IsOptional()
  comparativePeriodId?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
