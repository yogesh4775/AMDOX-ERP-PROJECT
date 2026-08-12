import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { ExpenseClaimStatus } from "@amdox/database/generated";

export class QueryClaimDto {
  @IsUUID()
  @IsOptional()
  employeeId?: string;

  @IsEnum(ExpenseClaimStatus)
  @IsOptional()
  status?: ExpenseClaimStatus;

  @IsString()
  @IsOptional()
  export?: string;
}
