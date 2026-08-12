import { IsDateString, IsNotEmpty, IsUUID } from "class-validator";

export class CreateDelegationDto {
  @IsUUID()
  @IsNotEmpty()
  toUserId!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}
