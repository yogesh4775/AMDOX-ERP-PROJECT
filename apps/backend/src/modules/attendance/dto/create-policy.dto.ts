import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  gracePeriodMinutes?: number;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  halfDayHours?: number;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  fullDayHours?: number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
