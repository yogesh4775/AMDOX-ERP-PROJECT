import { IsInt, Min } from "class-validator";

export class PostPaymentDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
