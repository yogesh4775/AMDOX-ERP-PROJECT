import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from "class-validator";

export class SubmitManagerReviewDto {
  @IsNumber()
  @Min(1.0)
  @Max(5.0)
  @IsNotEmpty()
  managerScore!: number;

  @IsString()
  @IsNotEmpty()
  managerFeedback!: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
