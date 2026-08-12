import { IsNotEmpty, IsArray, IsUUID, IsInt, Min } from "class-validator";

export class AssignPermissionsDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @IsArray()
  @IsUUID("all", { each: true })
  @IsNotEmpty()
  permissionIds!: string[];
}
