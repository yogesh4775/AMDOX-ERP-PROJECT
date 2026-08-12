import { IsDateString, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreatePeriodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}
