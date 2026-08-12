import { IsOptional, IsString, IsArray } from "class-validator";

export class FilterConditionDto {
  @IsOptional()
  equals?: unknown;

  @IsOptional()
  @IsString()
  contains?: string;

  @IsOptional()
  @IsString()
  startsWith?: string;

  @IsOptional()
  @IsString()
  endsWith?: string;

  @IsOptional()
  @IsArray()
  in?: unknown[];

  @IsOptional()
  @IsArray()
  between?: [unknown, unknown];
}
