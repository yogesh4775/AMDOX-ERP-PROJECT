import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export class AssignSalaryDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsUUID()
  @IsNotEmpty()
  salaryStructureId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
