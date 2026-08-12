import { IsOptional, IsBoolean } from "class-validator";
import { Transform } from "class-transformer";

export class CreateMediaDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true" || value === true)
  isPublic?: boolean;
}
