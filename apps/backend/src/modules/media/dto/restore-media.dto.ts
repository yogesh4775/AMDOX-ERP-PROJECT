import { IsOptional, IsInt } from "class-validator";

export class RestoreMediaDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
