import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class MfaDisableDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
