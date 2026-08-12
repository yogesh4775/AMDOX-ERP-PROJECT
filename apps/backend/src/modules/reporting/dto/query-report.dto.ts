import { IsOptional, IsEnum, IsDateString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { ReportType, ReportStatus } from "@amdox/database/generated";

export { ReportType, ReportStatus };

export class QueryReportDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @IsOptional()
  @IsDateString()
  createdAtTo?: string;
}
