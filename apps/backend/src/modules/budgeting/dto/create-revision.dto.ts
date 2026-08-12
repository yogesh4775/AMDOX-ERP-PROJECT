import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateRevisionItemDto {
  @IsUUID()
  @IsNotEmpty()
  glAccountId!: string;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  amount!: number;
}

export class CreateRevisionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRevisionItemDto)
  revisionItems!: CreateRevisionItemDto[];
}
