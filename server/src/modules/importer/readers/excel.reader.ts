import ExcelJS from "exceljs";
import { ImportRow } from "../models/import-row";
import { HEADER_ALIASES, STRONG_HEADERS, WEAK_HEADERS } from "../constants/header-keywords";

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

        console.log(rows[0]);

        for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber++) {

            const row = worksheet.getRow(rowNumber);

            const record: ImportRow = {};

            headers.forEach((header, index) => {
                record[header] = this.getCellValue(row.getCell(index + 1));
            });

            // Skip completely empty rows
            const hasData = Object.values(record).some(v =>
                v !== null &&
                String(v).trim() !== ""
            );

            if (!hasData)
                continue;

            // Generic footer detection
            const values = Object.values(record)
                .map(v => String(v ?? "").trim().toLowerCase());

            if (
                values.some(v =>
                    v === "total" ||
                    v === "grand total" ||
                    v === "subtotal"
                )
            ) {
                break;
            }

            // __________________________________________________________
            // | UPDATE: Added value cleaning in GST summation from      |
            // | CGST+SGST+IGST. Strips % symbols before Number().      |
            // |                                                         |
            // | WHY: The mapper fix alone isn't enough — the reader     |
            // | computes record.gst BEFORE the mapper runs. Without      |
            // | cleaning, "2.5%" produces NaN and GST shows as 0.       |
            // |__________________________________________________________|
            if (record.gst == null) {
                const clean = (v: any) => {
                    if (v == null) return 0;
                    if (typeof v === "number") return v;
                    const s = String(v).replace(/[₹$%,]/g, "").trim();
                    const n = parseFloat(s);
                    return isNaN(n) ? 0 : n;
                };
                let gst =
                    clean(record.cgst) +
                    clean(record.sgst) +
                    clean(record.igst);
                if (gst > 0 && gst <= 1) gst *= 100;
                record.gst = gst;
            }

            if (record.amount == null && record.total != null) {
                const cleaned = String(record.total).replace(/[₹$%,]/g, "").trim();
                record.amount = parseFloat(cleaned) || 0;
            }

            rows.push(record);

        }

        console.log("Headers:", headers);
        console.log("First record:", rows[0]);
        console.log("Total rows:", rows.length);

        return rows;
    }

    private detectHeaderRow(
        worksheet: ExcelJS.Worksheet
    ): { headerRow: number; headers: string[] } {

        let bestScore = 0;
        let bestRow = -1;
        let bestHeaders: string[] = [];

        for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber++) {

            const row = worksheet.getRow(rowNumber);

            const headers: string[] = [];

            let score = 0;

            for (let col = 1; col <= worksheet.columnCount; col++) {

                const original = row.getCell(col).text.trim();

                const normalized = this.normalizeHeader(original);

                headers.push(normalized);

                if (!normalized)
                    continue;

                if (STRONG_HEADERS.some(h => normalized.includes(h))) {
                    score += 2;
                }
                else if (WEAK_HEADERS.some(h => normalized.includes(h))) {
                    score += 1;
                }

            }

            if (score > bestScore) {

                bestScore = score;
                bestRow = rowNumber;
                bestHeaders = headers;

            }

        }

        if (bestScore < 6) {

            return {
                headerRow: -1,
                headers: []
            };

        }

        return {
            headerRow: bestRow,
            headers: bestHeaders
        };

    }

    private normalizeHeader(header: string): string {

        const value = String(header ?? "")
            .trim()
            .replace(/^\uFEFF/, "")
            .replace(/\s+/g, " ")
            .replace(/[₹$()%]/g, "")      // remove currency & %
            .replace(/\//g, " ")          // HSN/SAC -> HSN SAC
            .replace(/-/g, " ")
            .trim()
            .toLowerCase();

        return HEADER_ALIASES[value] ?? value;
    }

    private getCellValue(cell: ExcelJS.Cell): any {

        const value = cell.value;

        if (value == null)
            return null;

        if (typeof value === "object" && "formula" in value) {
            return value.result ?? null;
        }

        if (typeof value === "object" && "richText" in value) {
            return value.richText.map(r => r.text).join("");
        }

        if (typeof value === "object" && "text" in value) {
            return value.text;
        }

        return value;

    }

}