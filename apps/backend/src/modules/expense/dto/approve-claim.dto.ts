import { IsOptional, IsString } from "class-validator";

export class ApproveClaimDto {
  @IsString()
  @IsOptional()
  comment?: string;
}
