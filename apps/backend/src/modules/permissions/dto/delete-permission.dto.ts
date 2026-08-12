import { IsInt, Min } from "class-validator";

export class DeletePermissionDto {
  @IsInt()
  @Min(1)
  version!: number;
}
