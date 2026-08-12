import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class MfaEnableDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
