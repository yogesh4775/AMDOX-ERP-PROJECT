/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsString, IsNotEmpty, IsObject } from "class-validator";

export class ConnectProviderDto {
  @IsNotEmpty()
  @IsString()
  provider!: string;

  @IsNotEmpty()
  @IsObject()
  credentials!: Record<string, any>;
}
