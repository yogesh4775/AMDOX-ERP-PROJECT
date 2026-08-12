import { IsNotEmpty, IsString, IsIn } from "class-validator";

export class SortingDto {
  @IsString()
  @IsNotEmpty()
  field!: string;

  @IsIn(["asc", "desc", "ASC", "DESC"])
  order!: "asc" | "desc" | "ASC" | "DESC";
}
