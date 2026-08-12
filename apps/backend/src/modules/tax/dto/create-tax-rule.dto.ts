import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MaxLength,
} from "class-validator";

export class CreateTaxRuleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsUUID()
  @IsNotEmpty()
  taxCategoryId!: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(100)
  rate!: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  jurisdiction?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
