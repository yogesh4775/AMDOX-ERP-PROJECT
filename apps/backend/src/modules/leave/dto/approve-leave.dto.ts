import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { LeaveApprovalStatus } from "@amdox/database/generated";

export class ApproveLeaveDto {
  @IsEnum(LeaveApprovalStatus)
  @IsNotEmpty()
  status!: LeaveApprovalStatus;

  @IsString()
  @IsOptional()
  comment?: string;
}
