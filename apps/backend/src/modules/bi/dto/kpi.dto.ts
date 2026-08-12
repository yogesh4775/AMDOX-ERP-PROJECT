import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
} from "class-validator";

export class CreateKpiDefinitionDto {
  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsNumber()
  target!: number;

  @IsNotEmpty()
  @IsNumber()
  thresholdAlert!: number;

  @IsNotEmpty()
  @IsString()
  module!: string;
}

export class EvaluateKpiDto {
  @IsOptional()
  @IsUUID()
  kpiId?: string;
}
