import { IsEnum, IsOptional, IsObject, IsString } from "class-validator";
import { ReportType } from "@amdox/database/generated";

export { ReportType };

export class CreateReportDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsOptional()
  @IsObject()
  filters?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  format?: string;
}
