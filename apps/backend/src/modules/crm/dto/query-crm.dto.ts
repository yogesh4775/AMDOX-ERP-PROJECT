import { IsOptional, IsString } from "class-validator";

export class QueryCrmDto {
  @IsString()
  @IsOptional()
  export?: string;
}
