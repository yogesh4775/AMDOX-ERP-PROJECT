import { IsOptional, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";

export class QueryCustomerDto extends PaginationQueryDto {
  @IsOptional()
  @IsString({ message: "name must be a string" })
  name?: string;

  @IsOptional()
  @IsString({ message: "email must be a string" })
  email?: string;
}
