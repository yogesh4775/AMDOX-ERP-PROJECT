import { IsString, IsOptional, IsEmail, IsInt, Min } from "class-validator";

export class UpdateCustomerDto {
  @IsString({ message: "name must be a string" })
  @IsOptional()
  name?: string;

  @IsEmail({}, { message: "email must be a valid email address" })
  @IsOptional()
  email?: string;

  @IsString({ message: "phone must be a string" })
  @IsOptional()
  phone?: string;

  @IsString({ message: "address must be a string" })
  @IsOptional()
  address?: string;

  @IsInt({ message: "expectedVersion must be an integer" })
  @Min(1, { message: "expectedVersion must be at least 1" })
  expectedVersion!: number;
}
