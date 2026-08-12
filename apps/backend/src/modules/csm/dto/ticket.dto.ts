import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { TicketPriority, TicketStatus } from "@amdox/database/generated";

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsUUID()
  @IsNotEmpty()
  categoryId!: string;

  @IsUUID()
  @IsNotEmpty()
  customerId!: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  contractId?: string;
}

export class UpdateTicketDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsOptional()
  assignedAgentId?: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}

export class AddTicketNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}

export class SubmitCsatDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  comment?: string;
}

export class MergeTicketsDto {
  @IsUUID()
  @IsNotEmpty()
  primaryTicketId!: string;

  @IsUUID()
  @IsNotEmpty()
  secondaryTicketId!: string;
}

export class SplitTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  newTitle!: string;

  @IsString()
  @IsNotEmpty()
  newDescription!: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  noteIdsToMove?: string[];
}
