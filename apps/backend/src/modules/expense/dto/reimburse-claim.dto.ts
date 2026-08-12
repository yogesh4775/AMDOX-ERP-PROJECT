import { IsInt, IsNotEmpty, IsUUID } from "class-validator";

export class ReimburseClaimDto {
  @IsUUID()
  @IsNotEmpty()
  bankAccountId!: string;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
