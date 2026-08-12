import { IsOptional, IsInt, Min } from "class-validator";

export class DeleteNotificationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
