import { IsOptional, IsInt } from "class-validator";

export class RestoreUnitDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
