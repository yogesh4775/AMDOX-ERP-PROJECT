import { IsInt } from "class-validator";

export class DeleteProductDto {
  @IsInt()
  expectedVersion!: number;
}
