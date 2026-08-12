import { IsOptional, IsString, IsBoolean, IsInt } from "class-validator";

export class UpdateMediaDto {
  @IsOptional()
  @IsString()
  originalName?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsInt()
  expectedVersion?: number;
}
