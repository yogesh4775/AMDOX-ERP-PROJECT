import { IsOptional, IsString, IsEnum } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";

export class QueryUserDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEnum(["ACTIVE", "SUSPENDED", "INACTIVE"])
  status?: "ACTIVE" | "SUSPENDED" | "INACTIVE";

  @IsOptional()
  @IsString()
  roleId?: string;

  @IsOptional()
  @IsString()
  createdAt?: string;

  @IsOptional()
  @IsString()
  updatedAt?: string;
}
