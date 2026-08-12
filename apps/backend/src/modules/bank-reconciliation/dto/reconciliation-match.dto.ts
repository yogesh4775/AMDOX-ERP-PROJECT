import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from "class-validator";
import { MatchingStatus } from "@amdox/database/generated";

export class ReconciliationMatchDto {
  @IsUUID()
  @IsNotEmpty()
  reconciliationLineId!: string;

  @IsUUID()
  @IsOptional()
  bankTransactionId?: string;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  matchedAmount?: number;

  @IsEnum(MatchingStatus)
  @IsNotEmpty()
  matchingStatus!: MatchingStatus;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
