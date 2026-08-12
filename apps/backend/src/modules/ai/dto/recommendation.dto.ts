import { IsNotEmpty, IsNumber, Min } from "class-validator";

export class ApplyRecommendationDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  expectedVersion!: number;
}
