import {
  IsString,
  IsOptional,
  IsEmail,
  IsUrl,
  Matches,
  IsInt,
  Min,
} from "class-validator";

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  companyName?: string;

  @IsString()
  @IsOptional()
  legalName?: string;

  @IsUrl({}, { message: "logoUrl must be a valid URL" })
  @IsOptional()
  logoUrl?: string;

  @IsUrl({}, { message: "website must be a valid URL" })
  @IsOptional()
  website?: string;

  @IsEmail({}, { message: "email must be a valid email address" })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  taxNumber?: string;

  @Matches(/^[A-Za-z]{3}$/, {
    message: "Currency must be a 3-letter code (e.g. USD)",
  })
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  fiscalYearStart?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  postalCode?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsInt()
  @Min(1)
  version!: number;
}
