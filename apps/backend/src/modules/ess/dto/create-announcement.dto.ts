import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsDateString()
  @IsNotEmpty()
  publishDate!: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}
