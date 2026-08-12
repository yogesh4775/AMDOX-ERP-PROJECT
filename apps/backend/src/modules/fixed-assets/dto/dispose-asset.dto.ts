import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  Min,
} from "class-validator";

export class DisposeAssetDto {
  @IsDateString()
  @IsNotEmpty()
  disposalDate!: string;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  saleValue!: number;

  @IsUUID()
  @IsNotEmpty()
  cashAccountId!: string; // Cash/Bank/Receivables account

  @IsUUID()
  @IsNotEmpty()
  gainAccountId!: string;

  @IsUUID()
  @IsNotEmpty()
  lossAccountId!: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
