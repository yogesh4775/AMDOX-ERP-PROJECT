import { IsOptional, IsInt } from "class-validator";

export class RestoreCategoryDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
