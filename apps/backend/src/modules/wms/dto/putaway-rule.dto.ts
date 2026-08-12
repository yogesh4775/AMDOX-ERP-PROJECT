import { IsUUID, IsNotEmpty, IsOptional, IsNumber, Min } from "class-validator";

export class CreatePutawayRuleDto {
  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsUUID()
  @IsNotEmpty()
  preferredZoneId!: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  priority?: number;
}

export class UpdatePutawayRuleDto {
  @IsUUID()
  @IsOptional()
  preferredZoneId?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  priority?: number;
}
