import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  IsDateString,
  IsInt,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";
import { SalesOrderItemDto } from "./create-sales-order.dto";

export class UpdateSalesOrderDto {
  @IsUUID("4", { message: "customerId must be a valid UUID" })
  @IsOptional()
  customerId?: string;

  @IsDateString(
    {},
    { message: "expectedDeliveryDate must be a valid ISO date" },
  )
  @IsOptional()
  expectedDeliveryDate?: string;

  @IsString({ message: "notes must be a string" })
  @IsOptional()
  notes?: string;

  @IsArray({ message: "items must be an array" })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items?: SalesOrderItemDto[];

  @IsInt({ message: "expectedVersion must be an integer" })
  @Min(1, { message: "expectedVersion must be at least 1" })
  expectedVersion!: number;
}
