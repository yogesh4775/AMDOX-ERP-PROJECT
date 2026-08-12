import { IsNotEmpty, IsEnum, IsInt, Min } from "class-validator";

export class UpdateUserStatusDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @IsEnum(["ACTIVE", "SUSPENDED", "INACTIVE"])
  @IsNotEmpty()
  status!: "ACTIVE" | "SUSPENDED" | "INACTIVE";
}
