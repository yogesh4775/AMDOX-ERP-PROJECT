import { IsOptional, IsInt } from "class-validator";

export class DeleteReportDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
