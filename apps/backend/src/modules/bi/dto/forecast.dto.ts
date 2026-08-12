import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsUUID,
} from "class-validator";

import { Type } from "class-transformer";

export class ForecastQueryDto {
  @IsNotEmpty()
  @IsString()
  type!: string; // "sales" | "inventory" | "cash_flow"

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  periods?: number;

  @IsOptional()
  @IsString()
  method?: string; // "moving_average" | "linear_regression"
}
