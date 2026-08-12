import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
  IsArray,
} from "class-validator";
import { Type } from "class-transformer";

export class WorkflowStepDto {
  @IsNumber()
  @Min(1)
  level!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  approverType!: string; // "USER" | "ROLE" | "REPORTING_MANAGER" | "AND" | "OR"

  @IsString()
  @IsOptional()
  approverValue?: string; // specific user ID, role name, or comma-separated user IDs for AND/OR approvals

  @IsNumber()
  @Min(1)
  @IsOptional()
  slaHours?: number;

  @IsString()
  @IsOptional()
  escalationAction?: string; // "AUTO_APPROVE" | "AUTO_REJECT" | "ESCALATE_TO_MANAGER" | "ESCALATE_TO_ROLE"

  @IsString()
  @IsOptional()
  escalationValue?: string; // role name or user ID

  @IsOptional()
  conditions?: Record<string, unknown>; // rules JSON object
}

export class CreateDefinitionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps!: WorkflowStepDto[];
}
