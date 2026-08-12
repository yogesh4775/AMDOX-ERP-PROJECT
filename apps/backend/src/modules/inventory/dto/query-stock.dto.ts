import { IsOptional, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";

export class QueryStockDto extends PaginationQueryDto {
  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;
}
