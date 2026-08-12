import { IsOptional, IsString, IsEnum, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationQueryDto } from "../../../../common/pagination/dto/pagination-query.dto";
import { MasterStatus } from "@amdox/database/generated";

export class QueryWarehouseDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(MasterStatus)
  status?: MasterStatus;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeDeleted?: boolean;
}
