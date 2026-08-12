import { IsString, IsOptional, IsInt, Min } from "class-validator";

export class UpdatePermissionDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  version!: number;
}
