import { InventoryImport } from "../models/inventory-import";
import { ValidationError } from "../models/validation-error";
import { ValidationResult } from "../models/validation-result";

export class InventoryValidator {

    validate(rows: InventoryImport[]): ValidationResult {

        const validRows: InventoryImport[] = [];

        const invalidRows: ValidationError[] = [];

        rows.forEach((row, index) => {

            const errors = this.validateRow(row, index + 1);

            if (errors.length === 0) {

                validRows.push(row);

            } else {

                invalidRows.push(...errors);

            }

        });

        return {

            validRows,

            invalidRows

        };

    }

    private validateRow(
        row: InventoryImport,
        rowNumber: number
    ): ValidationError[] {

        const errors: ValidationError[] = [];

        if (!row.productName?.trim()) {

            errors.push({
                row: rowNumber,
                field: "productName",
                value: row.productName,
                message: "Product name is required"
            });

        }

        if (row.quantity <= 0) {

            errors.push({
                row: rowNumber,
                field: "quantity",
                value: row.quantity,
                message: "Quantity must be greater than zero"
            });

        }

        if (row.purchasePrice <= 0) {

            errors.push({
                row: rowNumber,
                field: "purchasePrice",
                value: row.purchasePrice,
                message: "Purchase price must be greater than zero"
            });

        }

        if (row.tax < 0) {

            errors.push({
                row: rowNumber,
                field: "tax",
                value: row.tax,
                message: "Invalid GST"
            });

        }

        return errors;

    }

}