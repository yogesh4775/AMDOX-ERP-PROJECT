import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsPositive,
} from "class-validator";
import { DefectSeverity } from "@amdox/database/generated";

export class RecordDefectDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(DefectSeverity)
  severity!: DefectSeverity;

  @IsNumber()
  @IsPositive()
  quantity!: number;
}
