import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class RecordCycleLineDto {
  @IsUUID()
  @IsNotEmpty()
  binId!: string;

  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(0)
  countedQty!: number;
}

export class CreateCycleCountDto {
  @IsUUID()
  @IsNotEmpty()
  warehouseId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordCycleLineDto)
  lines!: RecordCycleLineDto[];
}
