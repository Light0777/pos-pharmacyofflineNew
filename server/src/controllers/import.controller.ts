import { Request, Response } from "express";
import { ExcelReader } from "../modules/importer/readers/excel.reader";
import { Mapper } from "../modules/importer/mapping/mapper";
import { MappingProfile } from "../modules/importer/models/mapping-profile";
import { InventoryValidator } from "../modules/importer/validators/inventory.validator";

const reader = new ExcelReader();
const mapper = new Mapper();
const validator = new InventoryValidator();

export class ImportController {
  static async importExcel(
    req: Request & { file?: { path: string } },
    res: Response
  ) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Excel file is required.",
        });
      }

      // Step 1 - Read Excel
      const rows = await reader.read(req.file.path);

      // Step 2 - Temporary hardcoded mapping profile
      const profile: MappingProfile = {
        profileName: "Default",
        module: "inventory",
        fields: {
          productName: "Item Description",
          batchNo: "Batch No",
          expiry: "Expiry",
          quantity: "Qty",
          purchasePrice: "List Price",
          tax: "Tax %",
          hsn: "HSN/SAC",
          discount: "Disc %",
          amount: "Amount",
        },
      };

      // Step 3 - Map supplier columns to internal model
      const mappedRows = mapper.map(rows, profile);

      // Step 4 - Validate
      const validation = validator.validate(mappedRows);

      return res.status(200).json({
        success: true,
        summary: {
          total: mappedRows.length,
          valid: validation.validRows.length,
          invalid: validation.invalidRows.length,
        },
        validRows: validation.validRows,
        errors: validation.invalidRows,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Failed to import Excel.",
      });
    }
  }
}