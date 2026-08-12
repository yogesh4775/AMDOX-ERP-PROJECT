import { IsOptional, IsString, IsDateString, IsEnum } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { PurchaseOrderStatus } from "@amdox/database/generated";

export class QueryPurchaseOrderDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(PurchaseOrderStatus, {
    message: "status must be a valid PurchaseOrderStatus value",
  })
  status?: PurchaseOrderStatus;

  @IsOptional()
  @IsString({ message: "supplierName must be a string" })
  supplierName?: string;

  @IsOptional()
  @IsDateString({}, { message: "startDate must be a valid ISO date" })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: "endDate must be a valid ISO date" })
  endDate?: string;
}
