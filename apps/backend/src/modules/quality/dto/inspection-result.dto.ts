import {
  IsUUID,
  IsNumber,
  IsBoolean,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class RecordCharacteristicResultDto {
  @IsUUID()
  characteristicId!: string;

  @IsNumber()
  @IsOptional()
  measuredValue?: number;

  @IsBoolean()
  passed!: boolean;

  @IsString()
  @IsOptional()
  remarks?: string;
}

export class RecordInspectionResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordCharacteristicResultDto)
  results!: RecordCharacteristicResultDto[];
}
