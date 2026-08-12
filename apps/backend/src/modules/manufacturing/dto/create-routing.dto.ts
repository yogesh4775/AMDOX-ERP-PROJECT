import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsUUID,
  ValidateNested,
  IsArray,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class RoutingOperationDto {
  @IsUUID()
  @IsNotEmpty()
  workCenterId!: string;

  @IsNumber()
  @Min(1)
  sequence!: number;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  setupTimeMinutes!: number;

  @IsNumber()
  @Min(0)
  executionTimeMinutes!: number;
}

export class CreateRoutingDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoutingOperationDto)
  operations!: RoutingOperationDto[];
}
