import fs from "fs/promises";
import { parse } from "csv-parse/sync";

import { ImportRow } from "../models/import-row";

import { HEADER_ALIASES, STRONG_HEADERS, WEAK_HEADERS } from "../constants/header-keywords";

export class CsvReader {

    async read(filePath: string): Promise<ImportRow[]> {

        const buffer = await fs.readFile(filePath);

        let encoding: BufferEncoding = "utf8";

        if (buffer[0] === 0xff && buffer[1] === 0xfe) {
            encoding = "utf16le";
        }

        let content = buffer.toString(encoding);

        content = content.replace(/^\uFEFF/, "");

        const delimiter = this.detectDelimiter(content);

        const records: string[][] = parse(content, {
            delimiter,
            skip_empty_lines: true,
            relax_quotes: true,
            relax_column_count: true,
            trim: true
        });

        const { headerRow, headers } = this.detectHeaderRow(records);

        console.log(headers);

        if (headerRow === -1) {
            throw new Error("Unable to detect table header.");
        }

        const rows: ImportRow[] = [];

        console.log(rows[0]);

        for (let i = headerRow + 1; i < records.length; i++) {

            const values = records[i];

            if (!values?.length)
                continue;

            const row: ImportRow = {};

            headers.forEach((header, index) => {

                if (!header)
                    return;

                row[header] = this.convert(values[index]);

            });

            const hasData = Object.values(row).some(v =>
                v !== null &&
                String(v).trim() !== ""
            );

            if (!hasData)
                continue;

            const lowerValues = Object.values(row)
                .map(v => String(v ?? "").trim().toLowerCase());

            if (
                lowerValues.some(v =>
                    v === "total" ||
                    v === "grand total" ||
                    v === "subtotal"
                )
            ) {
                break;
            }

            rows.push(row);

        }

        console.log("Headers:", headers);
        console.log("First record:", rows[0]);
        console.log("Total rows:", rows.length);

        return rows;

    }

    private detectDelimiter(content: string): string {

        const sample = content
            .split(/\r?\n/)
            .slice(0, 5)
            .join("\n");

        const commas = (sample.match(/,/g) || []).length;
        const semicolons = (sample.match(/;/g) || []).length;
        const tabs = (sample.match(/\t/g) || []).length;

        if (tabs > commas && tabs > semicolons)
            return "\t";

        if (semicolons > commas)
            return ";";

        return ",";

    }

    private detectHeaderRow(records: string[][]) {

        let bestScore = 0;
        let bestRow = -1;
        let bestHeaders: string[] = [];

        for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {

            const headers = records[rowIndex]
                .map(v => String(v ?? "").trim());

            const normalized = headers.map(v => this.normalizeHeader(v));

            if (normalized.filter(Boolean).length < 3)
                continue;

            let score = 0;

            for (const value of normalized) {

                if (STRONG_HEADERS.some(h => value.includes(h))) {
                    score += 2;
                }
                else if (WEAK_HEADERS.some(h => value.includes(h))) {
                    score += 1;
                }

            }

            if (score > bestScore) {

                bestScore = score;
                bestRow = rowIndex;
                bestHeaders = normalized;

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
            .toLowerCase();

        return HEADER_ALIASES[value] ?? value;
    }

    private convert(value: any) {

        if (value == null)
            return null;

        const text = String(value).trim();

        if (!text)
            return null;

        // Remove commas in numbers
        const cleaned = text.replace(/,/g, "");

        // Percentage
        if (cleaned.endsWith("%")) {
            const n = Number(cleaned.slice(0, -1));
            return isNaN(n) ? text : n / 100;
        }

        const n = Number(cleaned);

        if (!isNaN(n))
            return n;

        return text;
    }

}