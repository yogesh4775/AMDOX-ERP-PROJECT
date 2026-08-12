import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { BudgetStatus } from "@amdox/database/generated";

export class BudgetApprovalDto {
  @IsEnum(BudgetStatus)
  @IsNotEmpty()
  status!: BudgetStatus;

  @IsString()
  @IsOptional()
  comment?: string;
}
