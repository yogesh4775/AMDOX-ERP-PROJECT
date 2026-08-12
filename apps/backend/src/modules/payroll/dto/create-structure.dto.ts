import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateStructureDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsNumber()
  @Min(0.01)
  baseSalary!: number;

  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  componentIds?: string[];
}
