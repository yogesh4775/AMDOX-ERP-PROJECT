/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsString, IsNotEmpty, IsObject } from "class-validator";

export class PredictDto {
  @IsNotEmpty()
  @IsString()
  modelName!: string;

  @IsNotEmpty()
  @IsObject()
  inputData!: Record<string, any>;
}
