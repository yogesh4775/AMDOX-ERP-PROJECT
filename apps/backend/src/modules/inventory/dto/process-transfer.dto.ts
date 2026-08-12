import { IsInt } from "class-validator";

export class ProcessStockTransferDto {
  @IsInt()
  expectedVersion!: number;
}
