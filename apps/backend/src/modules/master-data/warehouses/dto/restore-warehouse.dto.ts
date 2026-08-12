import { IsOptional, IsInt } from "class-validator";

export class RestoreWarehouseDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
