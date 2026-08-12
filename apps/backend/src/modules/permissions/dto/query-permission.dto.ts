import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";

export class QueryPermissionDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
