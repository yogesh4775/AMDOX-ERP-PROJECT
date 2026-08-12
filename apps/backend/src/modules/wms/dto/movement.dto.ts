import {
  IsUUID,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  IsOptional,
} from "class-validator";

export class CreateWarehouseMovementDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsUUID()
  @IsOptional()
  fromBinId?: string;

  @IsUUID()
  @IsNotEmpty()
  toBinId!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
