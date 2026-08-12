import { IsOptional, IsInt } from "class-validator";

export class DeleteWarehouseDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
