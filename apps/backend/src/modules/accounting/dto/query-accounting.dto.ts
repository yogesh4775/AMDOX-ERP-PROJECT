import { IsOptional, IsEnum, IsString } from "class-validator";
import { PaginationQueryDto } from "../../../common/pagination/dto/pagination-query.dto";
import {
  AccountType,
  AccountStatus,
  JournalEntryStatus,
  JournalSourceType,
} from "@amdox/database/generated";

export class QueryAccountDto extends PaginationQueryDto {
  @IsEnum(AccountType)
  @IsOptional()
  type?: AccountType;

  @IsEnum(AccountStatus)
  @IsOptional()
  status?: AccountStatus;

  @IsString()
  @IsOptional()
  code?: string;
}

export class QueryJournalDto extends PaginationQueryDto {
  @IsEnum(JournalEntryStatus)
  @IsOptional()
  status?: JournalEntryStatus;

  @IsEnum(JournalSourceType)
  @IsOptional()
  sourceType?: JournalSourceType;

  @IsString()
  @IsOptional()
  entryNumber?: string;
}
