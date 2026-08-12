import { IsInt, Min } from "class-validator";

export class PostJournalDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
