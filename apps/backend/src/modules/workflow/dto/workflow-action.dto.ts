import { IsArray, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export enum WorkflowAction {
  APPROVE = "APPROVE",
  REJECT = "REJECT",
}

export class WorkflowActionDto {
  @IsEnum(WorkflowAction)
  action!: WorkflowAction;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  attachments?: string[]; // IDs of uploaded MediaFiles
}
