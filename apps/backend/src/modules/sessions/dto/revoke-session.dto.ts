import { IsInt, Min, IsOptional } from "class-validator";

export class RevokeSessionDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;
}
