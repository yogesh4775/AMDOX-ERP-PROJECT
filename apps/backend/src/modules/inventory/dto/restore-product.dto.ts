import { IsInt } from "class-validator";

export class RestoreProductDto {
  @IsInt()
  expectedVersion!: number;
}
