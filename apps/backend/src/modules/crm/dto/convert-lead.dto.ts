import { IsOptional, IsString } from "class-validator";

export class ConvertLeadDto {
  @IsString()
  @IsOptional()
  address?: string;
}
