import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsInt,
} from "class-validator";
import { MasterStatus } from "@amdox/database/generated";

export class UpdateUnitDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  symbol?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsInt()
  expectedVersion!: number;
}
