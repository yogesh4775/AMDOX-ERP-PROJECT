import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
} from "class-validator";

export class CreateCompanyDto {
  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  code!: string;

  @IsNotEmpty()
  @IsString()
  legalName!: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsNotEmpty()
  @IsString()
  baseCurrency!: string;

  @IsNotEmpty()
  @IsString()
  country!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isConsolidationEntity?: boolean;
}
