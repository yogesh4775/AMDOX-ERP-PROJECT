import { IsNotEmpty, IsString, IsUUID } from "class-validator";

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  documentName!: string;

  @IsString()
  @IsNotEmpty()
  documentType!: string;

  @IsUUID()
  @IsNotEmpty()
  mediaFileId!: string;
}
