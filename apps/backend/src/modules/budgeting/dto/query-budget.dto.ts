import { IsInt, IsOptional, IsString, IsUUID } from "class-validator";
import { Transform } from "class-transformer";

export class QueryBudgetDto {
  @IsInt()
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  fiscalYear?: number;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
