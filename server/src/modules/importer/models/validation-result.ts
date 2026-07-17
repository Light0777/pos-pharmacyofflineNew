import { InventoryImport } from "./inventory-import";
import { ValidationError } from "./validation-error";

export interface ValidationResult {

    validRows: InventoryImport[];

    invalidRows: ValidationError[];

}