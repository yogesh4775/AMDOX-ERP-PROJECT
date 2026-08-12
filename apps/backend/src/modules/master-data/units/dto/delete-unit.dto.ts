import { IsOptional, IsInt } from "class-validator";

export class DeleteUnitDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
