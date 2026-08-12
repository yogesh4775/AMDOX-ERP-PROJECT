import {
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
} from "class-validator";

export class UpdateTenantDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEnum(["ACTIVE", "SUSPENDED", "INACTIVE"])
  status?: "ACTIVE" | "SUSPENDED" | "INACTIVE";
}
