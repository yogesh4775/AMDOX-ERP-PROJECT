import { IsOptional, IsInt } from "class-validator";

export class DeleteMediaDto {
  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
