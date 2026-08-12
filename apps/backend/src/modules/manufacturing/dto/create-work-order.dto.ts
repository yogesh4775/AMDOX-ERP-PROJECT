import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsDateString,
  Min,
} from "class-validator";

export class CreateWorkOrderDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsUUID()
  @IsNotEmpty()
  bomId!: string;

  @IsUUID()
  @IsNotEmpty()
  routingId!: string;

  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsDateString()
  @IsNotEmpty()
  plannedStartDate!: string;

  @IsDateString()
  @IsNotEmpty()
  plannedEndDate!: string;
}
