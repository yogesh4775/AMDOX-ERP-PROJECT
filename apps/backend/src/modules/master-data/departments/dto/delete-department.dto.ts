import { IsOptional, IsInt } from "class-validator";

export class DeleteDepartmentDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
