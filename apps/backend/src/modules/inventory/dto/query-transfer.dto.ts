import { IsOptional, IsEnum, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { StockTransferStatus } from "@amdox/database/generated";

export class QueryStockTransferDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(StockTransferStatus)
  status?: StockTransferStatus;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  includeDeleted?: boolean;
}
