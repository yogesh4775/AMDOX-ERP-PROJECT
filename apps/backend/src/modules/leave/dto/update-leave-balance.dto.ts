import { IsNotEmpty, IsNumber, Min } from "class-validator";

export class UpdateLeaveBalanceDto {
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  allocated!: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  accrued!: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  used!: number;

  @IsNumber()
  @IsNotEmpty()
  expectedVersion!: number;
}
