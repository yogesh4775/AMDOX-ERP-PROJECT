import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class SubmitSelfReviewDto {
  @IsUUID()
  @IsNotEmpty()
  appraisalCycleId!: string;

  @IsNumber()
  @Min(1.0)
  @Max(5.0)
  @IsNotEmpty()
  selfScore!: number;

  @IsString()
  @IsNotEmpty()
  selfFeedback!: string;
}
