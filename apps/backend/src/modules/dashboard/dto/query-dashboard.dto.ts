import { IsOptional, IsString, IsDateString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";

export class QueryDashboardDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  entity?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  tenant?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}
