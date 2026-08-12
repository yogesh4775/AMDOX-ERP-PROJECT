import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from "class-validator";

export class EtlSyncDto {
  @IsOptional()
  @IsString()
  pipeline?: string;

  @IsOptional()
  @IsBoolean()
  fullRebuild?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  batchSize?: number;
}
