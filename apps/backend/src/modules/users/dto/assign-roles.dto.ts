import { IsNotEmpty, IsArray, IsUUID, IsInt, Min } from "class-validator";

export class AssignRolesDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @IsArray()
  @IsUUID("all", { each: true })
  @IsNotEmpty()
  roleIds!: string[];
}
