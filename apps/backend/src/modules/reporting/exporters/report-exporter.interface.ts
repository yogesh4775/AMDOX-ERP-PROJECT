import { Readable } from "stream";

export interface ReportExporter {
  supports(format: string): boolean;
  export(
    headers: string[],
    getRows: () => AsyncGenerator<unknown[], void, unknown>,
  ): Promise<Readable>;
  getMimeType(): string;
  getFileExtension(): string;
}

export const REPORT_EXPORTERS = "REPORT_EXPORTERS";
