import { IsNotEmpty, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class DeleteUserDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;
}
