import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateBudgetDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
