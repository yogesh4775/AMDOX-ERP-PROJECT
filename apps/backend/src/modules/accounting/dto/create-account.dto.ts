import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { AccountType } from "@amdox/database/generated";

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsEnum(AccountType)
  @IsNotEmpty()
  type!: AccountType;

  @IsString()
  @IsOptional()
  description?: string;
}
