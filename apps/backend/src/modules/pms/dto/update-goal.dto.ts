import { IsEnum, IsInt, IsNotEmpty } from "class-validator";
import { GoalStatus } from "@amdox/database/generated";

export class UpdateGoalDto {
  @IsEnum(GoalStatus)
  @IsNotEmpty()
  status!: GoalStatus;

  @IsInt()
  @IsNotEmpty()
  expectedVersion!: number;
}
