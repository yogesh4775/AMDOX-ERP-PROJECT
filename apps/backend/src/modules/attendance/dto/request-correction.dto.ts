import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class RequestCorrectionDto {
  @IsDateString()
  @IsOptional()
  requestedCheckIn?: string;

  @IsDateString()
  @IsOptional()
  requestedCheckOut?: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
