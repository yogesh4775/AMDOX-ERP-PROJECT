import { IsInt, Min } from "class-validator";

export class ReversePaymentDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
