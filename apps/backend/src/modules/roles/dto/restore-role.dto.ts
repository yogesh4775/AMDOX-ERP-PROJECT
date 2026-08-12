import { IsNotEmpty, IsInt, Min } from "class-validator";

export class RestoreRoleDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;
}
