import { IsNotEmpty, IsString, Matches, IsInt, Min } from "class-validator";

export class ChangePasswordDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  version!: number;

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
