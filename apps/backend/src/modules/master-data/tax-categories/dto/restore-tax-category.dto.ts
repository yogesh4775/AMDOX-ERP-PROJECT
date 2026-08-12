import { IsOptional, IsInt } from "class-validator";

export class RestoreTaxCategoryDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
