import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { AssetStatus } from "@amdox/database/generated";

export class QueryAssetsDto {
  @IsEnum(AssetStatus)
  @IsOptional()
  status?: AssetStatus;

  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  export?: string;
}
