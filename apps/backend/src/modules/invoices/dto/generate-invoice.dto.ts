import { IsString, IsNotEmpty, IsUUID, IsIn } from "class-validator";

export class GenerateInvoiceDto {
  @IsString({ message: "sourceType must be a string" })
  @IsIn(["SalesOrder", "PurchaseOrder"], {
    message: "sourceType must be SalesOrder or PurchaseOrder",
  })
  @IsNotEmpty({ message: "sourceType is required" })
  sourceType!: "SalesOrder" | "PurchaseOrder";

  @IsUUID("4", { message: "sourceId must be a valid UUID" })
  @IsNotEmpty({ message: "sourceId is required" })
  sourceId!: string;
}
