import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { CRMActivityType } from "@amdox/database/generated";

export class CreateActivityDto {
  @IsUUID()
  @IsOptional()
  leadId?: string;

  @IsUUID()
  @IsOptional()
  opportunityId?: string;

  @IsEnum(CRMActivityType)
  @IsNotEmpty()
  type!: CRMActivityType;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  activityDate!: string;
}
