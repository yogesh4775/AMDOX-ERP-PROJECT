import { IsOptional, IsEnum, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { StockAdjustmentStatus } from "@amdox/database/generated";

export class QueryStockAdjustmentDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(StockAdjustmentStatus)
  status?: StockAdjustmentStatus;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  includeDeleted?: boolean;
}
