import { IsDateString, IsNotEmpty } from "class-validator";

export class RunDepreciationDto {
  @IsDateString()
  @IsNotEmpty()
  depreciationDate!: string;
}
