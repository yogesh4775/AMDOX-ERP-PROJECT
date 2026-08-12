/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsString, IsNotEmpty, IsOptional, IsObject } from "class-validator";

export class TrainModelDto {
  @IsNotEmpty()
  @IsString()
  modelName!: string;

  @IsOptional()
  @IsObject()
  hyperparameters?: Record<string, any>;
}
