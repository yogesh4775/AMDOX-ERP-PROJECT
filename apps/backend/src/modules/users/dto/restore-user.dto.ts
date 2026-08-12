import { IsNotEmpty, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class RestoreUserDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;
}
