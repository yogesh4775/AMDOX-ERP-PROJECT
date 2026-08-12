import { IsOptional, IsInt, Min } from "class-validator";

export class MarkReadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
