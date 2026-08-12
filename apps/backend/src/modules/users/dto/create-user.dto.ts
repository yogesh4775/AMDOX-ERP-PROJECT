import {
  IsNotEmpty,
  IsString,
  IsEmail,
  MaxLength,
  Matches,
} from "class-validator";

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message:
      "Username must contain only letters, numbers, underscores, dots, or hyphens.",
  })
  username!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/,
    {
      message:
        "Password must be at least 12 characters and include uppercase, lowercase, numbers, and special characters.",
    },
  )
  password!: string;
}
