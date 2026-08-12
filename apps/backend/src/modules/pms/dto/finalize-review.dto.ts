import { IsInt, IsNotEmpty, IsNumber, Max, Min } from "class-validator";

export class FinalizeReviewDto {
  @IsNumber()
  @Min(1.0)
  @Max(5.0)
  @IsNotEmpty()
  finalScore!: number;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
