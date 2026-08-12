import { IsDateString, IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export class AssignShiftDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsUUID()
  @IsNotEmpty()
  shiftId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
