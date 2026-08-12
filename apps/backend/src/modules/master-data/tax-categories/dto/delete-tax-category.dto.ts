import { IsOptional, IsInt } from "class-validator";

export class DeleteTaxCategoryDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
