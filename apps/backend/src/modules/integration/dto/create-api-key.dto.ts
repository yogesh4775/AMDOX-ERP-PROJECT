import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsDateString,
  IsNumber,
  Min,
} from "class-validator";

export class CreateApiKeyDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  scopes!: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitTps?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  dailyQuotaLimit?: number;
}
