import { IsOptional, IsUUID, IsEnum } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { StockTransactionType } from "@amdox/database/generated";

export class QueryStockMovementDto extends PaginationQueryDto {
  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsEnum(StockTransactionType)
  @IsOptional()
  type?: StockTransactionType;
}
