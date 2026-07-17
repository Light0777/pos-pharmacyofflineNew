import ExcelJS from "exceljs";
import { ImportRow } from "../models/import-row";

export class ExcelReader {
    async read(filePath: string): Promise<ImportRow[]> {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);

        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
            throw new Error("No worksheet found.");
        }

        const { headerRow, headers } = this.detectHeaderRow(worksheet);

        if (headerRow === -1) {
            throw new Error("Unable to detect table header.");
        }

        const rows: ImportRow[] = [];

        for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber++) {
            const row = worksheet.getRow(rowNumber);

            const record: ImportRow = {};
            let hasData = false;

            // Build record
            headers.forEach((header: string, index: number) => {
                record[header] = this.getCellValue(row.getCell(index + 1));
            });

            // Stop at footer
            const description = String(record["Item Description"] ?? "")
                .trim()
                .toLowerCase();

            if (
                description === "total" ||
                description === "grand total" ||
                description === "subtotal" ||
                description.includes("total")
            ) {
                break;
            }

            // Calculate amount if formula result missing
            if (record["Amount"] == null) {
                const qty = Number(record["Qty"] ?? 0);
                const price = Number(record["List Price"] ?? 0);
                const discount = Number(record["Disc %"] ?? 0);
                const tax = Number(record["Tax %"] ?? 0);

                record["Amount"] = Number(
                    (qty * price * (1 - discount) * (1 + tax)).toFixed(2)
                );
            }

            rows.push(record);

            if (hasData) {
                rows.push(record);
            }
        }

        return rows;
    }

    private detectHeaderRow(
        worksheet: ExcelJS.Worksheet
    ): { headerRow: number; headers: string[] } {

        const keywords = [
            "item",
            "description",
            "qty",
            "quantity",
            "price",
            "amount",
            "gst",
            "tax",
            "batch",
            "expiry",
            "hsn",
            "code",
            "disc"
        ];

        let bestScore = 0;
        let bestRow = -1;
        let bestHeaders: string[] = [];

        for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {

            const row = worksheet.getRow(rowNumber);

            const headers: string[] = [];
            let score = 0;

            for (let col = 1; col <= worksheet.columnCount; col++) {

                const value = row.getCell(col).text.trim();

                headers.push(value);

                if (!value) continue;

                const lower = value.toLowerCase();

                if (keywords.some(keyword => lower.includes(keyword))) {
                    score++;
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestRow = rowNumber;
                bestHeaders = headers;
            }
        }

        return {
            headerRow: bestRow,
            headers: bestHeaders
        };
    }

    private getCellValue(cell: ExcelJS.Cell): any {
        const value = cell.value;

        if (value == null) return null;

        // Formula cell
        if (typeof value === "object" && "formula" in value) {
            return value.result ?? null;
        }

        // Rich text
        if (typeof value === "object" && "richText" in value) {
            return value.richText.map(r => r.text).join("");
        }

        // Hyperlink
        if (typeof value === "object" && "text" in value) {
            return value.text;
        }

        return value;
    }
}