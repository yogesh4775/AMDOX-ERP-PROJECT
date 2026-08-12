import { IsNumber, Min, IsInt } from "class-validator";

export class PayInvoiceDto {
  @IsNumber({}, { message: "amount must be a number" })
  @Min(0.0001, { message: "amount must be greater than 0" })
  amount!: number;

  @IsInt({ message: "expectedVersion must be an integer" })
  @Min(1, { message: "expectedVersion must be at least 1" })
  expectedVersion!: number;
}
