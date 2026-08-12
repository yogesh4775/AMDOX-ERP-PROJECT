import { ITimestamped } from "./timestamped.interface";
import { ISoftDelete } from "./soft-delete.interface";

export interface IAuditable extends ITimestamped, ISoftDelete {
  createdBy: string | null;
  updatedBy: string | null;
}
