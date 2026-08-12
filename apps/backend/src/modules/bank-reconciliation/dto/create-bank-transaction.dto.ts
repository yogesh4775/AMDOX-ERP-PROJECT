import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { BankTransactionType } from "@amdox/database/generated";

export class CreateBankTransactionDto {
  @IsUUID()
  @IsNotEmpty()
  bankAccountId!: string;

  @IsEnum(BankTransactionType)
  @IsNotEmpty()
  type!: BankTransactionType;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;

  @IsDateString()
  @IsNotEmpty()
  transactionDate!: string;

  @IsString()
  @IsNotEmpty()
  reference!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  transferToBankAccountId?: string;

  @IsUUID()
  @IsOptional()
  contraAccountId?: string;
}
