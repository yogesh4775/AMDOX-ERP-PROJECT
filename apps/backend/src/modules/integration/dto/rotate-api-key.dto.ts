import { IsNotEmpty, IsNumber, Min } from "class-validator";

export class RotateApiKeyDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  expectedVersion!: number;
}
