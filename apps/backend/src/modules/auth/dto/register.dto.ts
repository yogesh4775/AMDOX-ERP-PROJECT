import { IsEmail, IsNotEmpty, Matches } from "class-validator";

export class RegisterDto {
  @IsEmail({}, { message: "Invalid email address format" })
  @IsNotEmpty()
  email!: string;

  @Matches(/^[a-zA-Z0-9_]{3,30}$/, {
    message:
      "Username must be 3-30 characters long and contain only letters, numbers, and underscores",
  })
  @IsNotEmpty()
  username!: string;

  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{12,}$/, {
    message:
      "Password must be at least 12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  })
  @IsNotEmpty()
  password!: string;
}
