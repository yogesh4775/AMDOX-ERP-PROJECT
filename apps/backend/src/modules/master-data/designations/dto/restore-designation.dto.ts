import { IsOptional, IsInt } from "class-validator";

export class RestoreDesignationDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
