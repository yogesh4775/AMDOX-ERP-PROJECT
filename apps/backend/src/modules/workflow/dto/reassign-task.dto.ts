import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

export class ReassignTaskDto {
  @IsUUID()
  @IsNotEmpty()
  targetUserId!: string;

  @IsString()
  @IsOptional()
  comment?: string;
}
