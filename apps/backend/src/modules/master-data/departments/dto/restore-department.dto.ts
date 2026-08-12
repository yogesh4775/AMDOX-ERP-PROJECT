import { IsOptional, IsInt } from "class-validator";

export class RestoreDepartmentDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
