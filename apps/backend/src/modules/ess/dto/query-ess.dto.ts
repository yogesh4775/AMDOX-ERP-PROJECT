import { IsOptional, IsString } from "class-validator";

export class QueryEssDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
