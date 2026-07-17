import { InventoryImport } from "./inventory-import";
import { ValidationError } from "./validation-error";

export interface PreviewResult {

    summary: {

        total: number;

        valid: number;

        invalid: number;

    };

    rows: InventoryImport[];

    errors: ValidationError[];

}