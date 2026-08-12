import {
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsString,
  MaxLength,
  IsBoolean,
} from "class-validator";
import { Transform } from "class-transformer";

export class UpdateRoleDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
