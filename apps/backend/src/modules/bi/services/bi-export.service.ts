/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from "@nestjs/common";
import { Readable } from "stream";
import PDFDocument from "pdfkit";

@Injectable()
export class BiExportService {
  async exportCsv(headers: string[], rows: any[][]): Promise<Readable> {
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return "";
      let str = typeof val === "object" ? JSON.stringify(val) : String(val);
      if (/[",\n\r]/.test(str)) {
        str = str.replace(/"/g, '""');
        return `"${str}"`;
      }
      return str;
    };

    const headerLine = headers.map(escapeCsv).join(",") + "\n";
    const dataLines = rows.map((row) => row.map(escapeCsv).join(",") + "\n");

    const readable = new Readable();
    readable.push(headerLine);
    for (const line of dataLines) {
      readable.push(line);
    }
    readable.push(null);
    return readable;
  }

  async exportExcel(headers: string[], rows: any[][]): Promise<Readable> {
    // Generate an Excel-compatible HTML spreadsheet
    let html = `<html><head><meta charset="utf-8"><style>table { border-collapse: collapse; } th, td { border: 1px solid #ccc; padding: 6px; text-align: left; } th { background-color: #f2f2f2; }</style></head><body><table><thead><tr>`;
    for (const h of headers) {
      html += `<th>${this.escapeHtml(h)}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (const row of rows) {
      html += `<tr>`;
      for (const val of row) {
        html += `<td>${this.escapeHtml(val === null || val === undefined ? "" : String(val))}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></body></html>`;

    const readable = new Readable();
    readable.push(html);
    readable.push(null);
    return readable;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async exportPdf(
    title: string,
    headers: string[],
    rows: any[][],
  ): Promise<Readable> {
    const doc = new PDFDocument({ margin: 30 });

    doc.fontSize(16).text(title, { align: "center" });
    doc.moveDown();
    doc.fontSize(10).text(`Generated Date: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Render simple table in PDF
    let y = doc.y;
    const colWidth = 540 / Math.max(1, headers.length);

    // Render Headers
    doc.fontSize(9).fillColor("#000000");
    headers.forEach((h, i) => {
      doc.text(h, 30 + i * colWidth, y, {
        width: colWidth - 5,
        lineBreak: false,
      });
    });
    doc.moveDown();
    y = doc.y;
    doc.moveTo(30, y).lineTo(570, y).stroke();
    doc.moveDown(0.5);

    // Render Rows
    y = doc.y;
    rows.forEach((row) => {
      // Check page overflow
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      row.forEach((val, i) => {
        const textVal = val === null || val === undefined ? "" : String(val);
        doc.text(textVal, 30 + i * colWidth, y, {
          width: colWidth - 5,
          lineBreak: false,
        });
      });
      y += 15;
    });

    doc.end();
    return doc;
  }
}
