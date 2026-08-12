import {
  IsNotEmpty,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsEmail,
  MaxLength,
  Matches,
} from "class-validator";

export class UpdateUserDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      "Username must contain only letters, numbers, underscores, dots, or hyphens.",
  })
  username?: string;
}
