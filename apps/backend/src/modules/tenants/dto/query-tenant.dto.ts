import { IsOptional, IsString, IsEnum } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";

export class QueryTenantDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsEnum(["ACTIVE", "SUSPENDED", "INACTIVE"])
  status?: "ACTIVE" | "SUSPENDED" | "INACTIVE";
}
