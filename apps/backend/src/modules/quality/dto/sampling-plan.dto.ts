import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
  IsOptional,
} from "class-validator";

export class CreateSamplingPlanDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsPositive()
  aql!: number;

  @IsNumber()
  @Min(1)
  lotSizeMin!: number;

  @IsNumber()
  @Min(1)
  lotSizeMax!: number;

  @IsNumber()
  @IsPositive()
  sampleSize!: number;

  @IsNumber()
  @Min(0)
  acceptNumber!: number;

  @IsNumber()
  @IsPositive()
  rejectNumber!: number;
}

export class UpdateSamplingPlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  aql?: number;

  @IsNumber()
  @IsOptional()
  lotSizeMin?: number;

  @IsNumber()
  @IsOptional()
  lotSizeMax?: number;

  @IsNumber()
  @IsOptional()
  sampleSize?: number;

  @IsNumber()
  @IsOptional()
  acceptNumber?: number;

  @IsNumber()
  @IsOptional()
  rejectNumber?: number;
}
