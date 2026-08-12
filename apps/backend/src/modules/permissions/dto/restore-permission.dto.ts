import { IsInt, Min } from "class-validator";

export class RestorePermissionDto {
  @IsInt()
  @Min(1)
  version!: number;
}
