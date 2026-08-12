import { IsString, IsNotEmpty, IsOptional, IsEmail } from "class-validator";

export class CreateCustomerDto {
  @IsString({ message: "name must be a string" })
  @IsNotEmpty({ message: "name is required" })
  name!: string;

  @IsEmail({}, { message: "email must be a valid email address" })
  @IsOptional()
  email?: string;

  @IsString({ message: "phone must be a string" })
  @IsOptional()
  phone?: string;

  @IsString({ message: "address must be a string" })
  @IsOptional()
  address?: string;
}
