import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdateAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  industry?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
