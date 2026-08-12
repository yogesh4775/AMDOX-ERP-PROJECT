import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsNumber,
  IsOptional,
  IsPositive,
} from "class-validator";
import {
  InspectionLotType,
  InspectionLotStatus,
} from "@amdox/database/generated";

export class CreateInspectionLotDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsUUID()
  productId!: string;

  @IsEnum(InspectionLotType)
  type!: InspectionLotType;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  @IsOptional()
  purchaseReceiptId?: string;

  @IsUUID()
  @IsOptional()
  workOrderId?: string;

  @IsUUID()
  @IsOptional()
  inspectionPlanId?: string;
}

export class UpdateInspectionLotDto {
  @IsEnum(InspectionLotStatus)
  @IsOptional()
  status?: InspectionLotStatus;
}
