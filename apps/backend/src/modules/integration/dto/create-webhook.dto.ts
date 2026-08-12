import { IsString, IsNotEmpty, IsArray } from "class-validator";

export class CreateWebhookDto {
  @IsNotEmpty()
  @IsString()
  url!: string;

  @IsNotEmpty()
  @IsArray()
  @IsString({ each: true })
  events!: string[];
}
