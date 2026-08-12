import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  IsNumber,
  IsBoolean,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CharacteristicType,
  InspectionPlanStatus,
} from "@amdox/database/generated";

export class CreateCharacteristicDto {
  @IsInt()
  sequence!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(CharacteristicType)
  type!: CharacteristicType;

  @IsNumber()
  @IsOptional()
  upperLimit?: number;

  @IsNumber()
  @IsOptional()
  lowerLimit?: number;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;
}

export class CreateInspectionPlanDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUUID()
  productId!: string;

  @IsUUID()
  @IsOptional()
  samplingPlanId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCharacteristicDto)
  characteristics!: CreateCharacteristicDto[];
}

export class UpdateInspectionPlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(InspectionPlanStatus)
  @IsOptional()
  status?: InspectionPlanStatus;

  @IsUUID()
  @IsOptional()
  samplingPlanId?: string;
}
