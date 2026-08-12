import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";
import {
  SalaryComponentType,
  CalculationType,
} from "@amdox/database/generated";

export class CreateComponentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsEnum(SalaryComponentType)
  @IsNotEmpty()
  type!: SalaryComponentType;

  @IsEnum(CalculationType)
  @IsNotEmpty()
  calculationType!: CalculationType;

  @IsNumber()
  @Min(0)
  value!: number;
}
