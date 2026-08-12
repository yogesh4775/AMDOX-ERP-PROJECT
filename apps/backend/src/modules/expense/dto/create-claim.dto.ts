import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateClaimItemDto {
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  receiptUrl?: string;
}

export class CreateClaimDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsDateString()
  @IsNotEmpty()
  claimDate!: string;

  @IsUUID()
  @IsNotEmpty()
  employeeId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClaimItemDto)
  @IsNotEmpty()
  items!: CreateClaimItemDto[];
}
