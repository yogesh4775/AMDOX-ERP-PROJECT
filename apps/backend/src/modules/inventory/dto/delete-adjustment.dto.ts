import { IsInt } from "class-validator";

export class DeleteStockAdjustmentDto {
  @IsInt()
  expectedVersion!: number;
}
