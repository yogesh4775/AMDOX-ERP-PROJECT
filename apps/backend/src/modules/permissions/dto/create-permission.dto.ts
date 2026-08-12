import { IsString, Matches, IsOptional } from "class-validator";

export class CreatePermissionDto {
  @IsString()
  @Matches(/^[a-z]+:[a-z-]+$/, {
    message:
      "Permission name must match format: resource:action (e.g. user:create)",
  })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
