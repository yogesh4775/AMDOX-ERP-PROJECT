import { Readable } from "stream";

export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StorageProvider {
  upload(
    file: MulterFile,
    storedName: string,
    tenantId: string,
  ): Promise<string>;
  delete(storagePath: string): Promise<void>;
  getStream(storagePath: string): Promise<Readable>;
}

export const STORAGE_PROVIDER_TOKEN = "STORAGE_PROVIDER_TOKEN";
