import { IsNotEmpty, IsBoolean, IsInt, Min } from "class-validator";

export class UpdateRoleStatusDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;
}
