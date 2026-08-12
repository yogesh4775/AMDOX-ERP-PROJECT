import { IsOptional, IsInt } from "class-validator";

export class DeleteDesignationDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
