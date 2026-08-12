import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { BankAccountCategory } from "@amdox/database/generated";

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsString()
  @IsOptional()
  iban?: string;

  @IsString()
  @IsOptional()
  swiftCode?: string;

  @IsString()
  @IsNotEmpty()
  currency!: string;

  @IsEnum(BankAccountCategory)
  @IsNotEmpty()
  category!: BankAccountCategory;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  openingBalance!: number;

  @IsUUID()
  @IsNotEmpty()
  glAccountId!: string;
}
