import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { LeadSource } from "@amdox/database/generated";

export class CreateLeadDto {
  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(LeadSource)
  @IsOptional()
  source?: LeadSource;
}
