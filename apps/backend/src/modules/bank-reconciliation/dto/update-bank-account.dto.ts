import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { BankAccountStatus } from "@amdox/database/generated";

export class UpdateBankAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(BankAccountStatus)
  @IsOptional()
  status?: BankAccountStatus;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
