import { IsOptional, IsString, IsUUID } from "class-validator";

export class QueryParamsDto {
  @IsUUID()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
