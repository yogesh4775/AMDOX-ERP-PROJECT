import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { TicketPriority } from "@amdox/database/generated";

export class CreateSlaPolicyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsEnum(TicketPriority)
  @IsNotEmpty()
  priority!: TicketPriority;

  @IsInt()
  @Min(1)
  responseTimeLimitMin!: number;

  @IsInt()
  @Min(1)
  resolutionTimeLimitMin!: number;
}

export class UpdateSlaPolicyDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsInt()
  @Min(1)
  @IsOptional()
  responseTimeLimitMin?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  resolutionTimeLimitMin?: number;
}
