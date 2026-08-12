import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsOptional,
  IsDateString,
} from "class-validator";
import { CAPAType, CAPAStatus } from "@amdox/database/generated";

export class CreateCAPADto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsUUID()
  @IsOptional()
  ncrId?: string;

  @IsEnum(CAPAType)
  type!: CAPAType;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  rootCause?: string;

  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @IsDateString()
  targetCompletionDate!: string;
}

export class UpdateCAPADto {
  @IsString()
  @IsOptional()
  rootCause?: string;

  @IsEnum(CAPAStatus)
  @IsOptional()
  status?: CAPAStatus;

  @IsUUID()
  @IsOptional()
  assignedToId?: string;

  @IsDateString()
  @IsOptional()
  targetCompletionDate?: string;
}
