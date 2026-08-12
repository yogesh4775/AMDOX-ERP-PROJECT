import { IsOptional, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class QuerySessionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
