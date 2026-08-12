import { IsNotEmpty, IsInt, Min } from "class-validator";
import { Type } from "class-transformer";

export class DeleteTenantDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;
}
