import { IsNumber, IsOptional, Min } from "class-validator";

export class LogOperationDto {
  @IsNumber()
  @Min(0)
  actualSetupTimeMinutes!: number;

  @IsNumber()
  @Min(0)
  actualExecutionTimeMinutes!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  scrapQuantity?: number;
}
