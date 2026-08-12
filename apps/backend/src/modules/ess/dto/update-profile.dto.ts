import { IsOptional, IsString, IsInt, Matches } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Phone number must be in E.164 format (e.g. +1234567890).",
  })
  phone?: string;

  @IsString()
  @IsOptional()
  emergencyContactName?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message:
      "Emergency contact phone must be in E.164 format (e.g. +1234567890).",
  })
  emergencyContactPhone?: string;

  @IsString()
  @IsOptional()
  profilePhoto?: string;

  @IsInt()
  expectedVersion!: number;
}
