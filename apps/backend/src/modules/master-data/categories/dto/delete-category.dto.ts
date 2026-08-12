import { IsOptional, IsInt } from "class-validator";

export class DeleteCategoryDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
