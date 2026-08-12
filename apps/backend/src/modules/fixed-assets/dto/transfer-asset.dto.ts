import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class TransferAssetDto {
  @IsDateString()
  @IsNotEmpty()
  transferDate!: string;

  @IsString()
  @IsNotEmpty()
  toLocation!: string;

  @IsString()
  @IsNotEmpty()
  toDepartment!: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
