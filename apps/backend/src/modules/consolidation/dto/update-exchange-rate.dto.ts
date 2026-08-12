import { IsString, IsNotEmpty, IsNumber, IsDateString } from "class-validator";

export class UpdateExchangeRateDto {
  @IsNotEmpty()
  @IsString()
  fromCurrency!: string;

  @IsNotEmpty()
  @IsString()
  toCurrency!: string;

  @IsNotEmpty()
  @IsNumber()
  rate!: number;

  @IsNotEmpty()
  @IsDateString()
  rateDate!: string;
}
