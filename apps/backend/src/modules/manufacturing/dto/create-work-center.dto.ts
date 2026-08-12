import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  Min,
} from "class-validator";
import { WorkCenterStatus } from "@amdox/database/generated";

export class CreateWorkCenterDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  overheadRate!: number;

  @IsNumber()
  @Min(0)
  capacity!: number;

  @IsUUID()
  @IsOptional()
  assetId?: string;

  @IsEnum(WorkCenterStatus)
  @IsOptional()
  status?: WorkCenterStatus;
}
