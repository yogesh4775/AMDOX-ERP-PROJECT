import { IsInt } from "class-validator";

export class DeleteStockTransferDto {
  @IsInt()
  expectedVersion!: number;
}
