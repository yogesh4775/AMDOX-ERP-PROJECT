import { IsEmail, IsInt, IsNotEmpty } from "class-validator";

export class UpdateEmailDto {
  @IsEmail()
  @IsNotEmpty()
  newEmail!: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
