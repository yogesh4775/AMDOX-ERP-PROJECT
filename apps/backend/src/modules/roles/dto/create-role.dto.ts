import { IsNotEmpty, IsString, MaxLength, IsOptional } from "class-validator";
import { Transform } from "class-transformer";

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
