import { IsNotEmpty, IsString } from "class-validator";

export class MfaVerifyDto {
  @IsString()
  @IsNotEmpty()
  mfaRequiredToken!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
