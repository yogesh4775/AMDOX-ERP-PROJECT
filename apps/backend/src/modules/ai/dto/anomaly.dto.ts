import { IsNotEmpty, IsNumber, Min } from "class-validator";

export class ResolveAnomalyDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  expectedVersion!: number;
}
