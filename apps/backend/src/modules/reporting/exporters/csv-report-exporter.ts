import { Readable } from "stream";
import { Injectable } from "@nestjs/common";
import { ReportExporter } from "./report-exporter.interface";

@Injectable()
export class CsvReportExporter implements ReportExporter {
  supports(format: string): boolean {
    return format.toLowerCase() === "csv";
  }

  getMimeType(): string {
    return "text/csv";
  }

  getFileExtension(): string {
    return "csv";
  }

  private escapeCsvValue(val: unknown): string {
    if (val === null || val === undefined) {
      return "";
    }
    let str = "";
    if (typeof val === "object") {
      str = JSON.stringify(val);
    } else {
      str = String(val);
    }
    if (/[",\n\r]/.test(str)) {
      str = str.replace(/"/g, '""');
      return `"${str}"`;
    }
    return str;
  }

  async export(
    headers: string[],
    getRows: () => AsyncGenerator<unknown[], void, unknown>,
  ): Promise<Readable> {
    const generator = getRows();
    let headersWritten = false;
    const escapeCsv = (val: unknown) => this.escapeCsvValue(val);

    return new Readable({
      async read(this: Readable) {
        try {
          if (!headersWritten) {
            headersWritten = true;
            const headerLine = headers.map(escapeCsv).join(",") + "\n";
            this.push(headerLine);
            return;
          }

          const { value, done } = await generator.next();

          if (done) {
            this.push(null);
          } else {
            const line = value.map(escapeCsv).join(",") + "\n";
            this.push(line);
          }
        } catch (err) {
          this.destroy(err as Error);
        }
      },
    });
  }
}
