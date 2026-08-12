import { IsInt } from "class-validator";

export class ApproveStockAdjustmentDto {
  @IsInt()
  expectedVersion!: number;
}
