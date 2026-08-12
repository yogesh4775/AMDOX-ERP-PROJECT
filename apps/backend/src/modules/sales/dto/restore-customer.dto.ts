import { IsInt, Min } from "class-validator";

export class RestoreCustomerDto {
  @IsInt({ message: "expectedVersion must be an integer" })
  @Min(1, { message: "expectedVersion must be at least 1" })
  expectedVersion!: number;
}
