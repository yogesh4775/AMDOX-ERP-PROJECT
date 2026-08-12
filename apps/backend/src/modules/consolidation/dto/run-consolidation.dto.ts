import { IsNotEmpty, IsUUID, IsDateString } from "class-validator";

export class RunConsolidationDto {
  @IsNotEmpty()
  @IsUUID()
  parentCompanyId!: string;

  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsNotEmpty()
  @IsDateString()
  endDate!: string;
}
