import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateJournalLineDto {
  @IsUUID("4")
  @IsNotEmpty()
  accountId!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  debit!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  credit!: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateJournalDto {
  @IsDateString()
  @IsNotEmpty()
  postingDate!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
