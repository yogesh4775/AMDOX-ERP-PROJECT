import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateContractDto {
  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  contractNumber!: string;

  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsInt()
  @Min(0)
  warrantyPeriod!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  status!: string; // ACTIVE, EXPIRED, SUSPENDED
}

export class UpdateContractDto {
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  contractNumber?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  warrantyPeriod?: number;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  status?: string;
}
