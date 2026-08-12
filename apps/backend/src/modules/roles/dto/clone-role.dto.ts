import { IsOptional, IsString, MaxLength } from "class-validator";

export class CloneRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;
}
