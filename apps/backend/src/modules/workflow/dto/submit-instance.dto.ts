import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class SubmitInstanceDto {
  @IsString()
  @IsNotEmpty()
  entityType!: string;

  @IsUUID()
  @IsNotEmpty()
  entityId!: string;

  @IsString()
  @IsNotEmpty()
  definitionCode!: string;
}
