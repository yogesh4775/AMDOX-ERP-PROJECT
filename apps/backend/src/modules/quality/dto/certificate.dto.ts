import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsDateString,
} from "class-validator";

export class CreateCertificateDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsUUID()
  inspectionLotId!: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}
