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

export class BOMItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsUUID()
  @IsNotEmpty()
  unitId!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  scrapFactor?: number;
}

export class CreateBOMDto {
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

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BOMItemDto)
  items!: BOMItemDto[];
}
