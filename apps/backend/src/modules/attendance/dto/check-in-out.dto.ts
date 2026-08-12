import { IsDateString, IsNotEmpty, IsUUID } from "class-validator";

export class CheckInOutDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsDateString()
  @IsNotEmpty()
  timestamp!: string;
}
