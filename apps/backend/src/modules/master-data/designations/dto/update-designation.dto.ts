import {
  IsString,
  IsOptional,
  MaxLength,
  IsEnum,
  IsInt,
} from "class-validator";
import { MasterStatus } from "@amdox/database/generated";

export class UpdateDesignationDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsInt()
  expectedVersion!: number;
}
