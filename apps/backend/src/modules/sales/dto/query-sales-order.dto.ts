import { IsOptional, IsDateString, IsEnum, IsUUID } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import { SalesOrderStatus } from "@amdox/database/generated";

export class QuerySalesOrderDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SalesOrderStatus, {
    message: "status must be a valid SalesOrderStatus value",
  })
  status?: SalesOrderStatus;

  @IsOptional()
  @IsUUID("4", { message: "customerId must be a valid UUID" })
  customerId?: string;

  @IsOptional()
  @IsDateString({}, { message: "startDate must be a valid ISO date" })
  startDate?: string;

  @IsOptional()
  @IsDateString({}, { message: "endDate must be a valid ISO date" })
  endDate?: string;
}
