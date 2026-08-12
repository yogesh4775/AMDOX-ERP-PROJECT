import { IsEnum, IsOptional } from "class-validator";
import { NCRStatus, NCROutcome } from "@amdox/database/generated";

export class UpdateNCRDto {
  @IsEnum(NCROutcome)
  @IsOptional()
  actionTaken?: NCROutcome;

  @IsEnum(NCRStatus)
  @IsOptional()
  status?: NCRStatus;
}
