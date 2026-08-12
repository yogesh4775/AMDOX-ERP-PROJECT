import { IsDateString, IsOptional, IsString, IsUUID } from "class-validator";

export class QueryTaxTransactionDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  periodId?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
