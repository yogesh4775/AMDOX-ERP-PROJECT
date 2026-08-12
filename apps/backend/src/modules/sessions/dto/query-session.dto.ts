import { IsOptional, IsEnum, IsDateString, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";

export enum SessionStatusFilter {
  ACTIVE = "active",
  REVOKED = "revoked",
  EXPIRED = "expired",
}

export class QuerySessionDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(SessionStatusFilter)
  status?: SessionStatusFilter;

  @IsOptional()
  @IsDateString()
  createdAtFrom?: string;

  @IsOptional()
  @IsDateString()
  createdAtTo?: string;

  @IsOptional()
  @IsDateString()
  expiresAtFrom?: string;

  @IsOptional()
  @IsDateString()
  expiresAtTo?: string;

  @IsOptional()
  @IsDateString()
  revokedAtFrom?: string;

  @IsOptional()
  @IsDateString()
  revokedAtTo?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  isCurrent?: string;

  @IsOptional()
  @IsString()
  device?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
