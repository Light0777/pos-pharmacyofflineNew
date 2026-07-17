import { Request, Response } from "express";
import { ExcelReader } from "../modules/importer/readers/excel.reader";
import { Mapper } from "../modules/importer/mapping/mapper";
import { MappingProfile } from "../modules/importer/models/mapping-profile";
import { ProfileService } from "../modules/importer/services/preview.service";
import { AutoUpdateService } from "../services/AutoUpdateService";
import { AutoUpdateRequest } from "../types/supplierInvoice";

const reader = new ExcelReader();
const mapper = new Mapper();
const profileService = new ProfileService();

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

      // Read Excel
      const rows = await reader.read(req.file.path);

      // Temporary mapping profile
      const profile = await profileService.getDefault("purchase");

      // Map to SupplierInvoiceItem[]
      const items = mapper.map(rows, profile);

      // Return preview payload
      return res.status(200).json({
        success: true,
        data: {
          supplier_uuid: null,
          invoice_number: null,
          invoice_date: null,
          items,
        },
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Failed to import Excel.",
      });
    }
  }

  static async commitImport(req: Request, res: Response) {
    try {

      const data = req.body as AutoUpdateRequest;

      if (!data.supplier_uuid) {
        return res.status(400).json({
          success: false,
          message: "Supplier is required."
        });
      }

      if (!data.invoice_number) {
        return res.status(400).json({
          success: false,
          message: "Invoice number is required."
        });
      }

      if (!data.invoice_date) {
        return res.status(400).json({
          success: false,
          message: "Invoice date is required."
        });
      }

      if (!data.items?.length) {
        return res.status(400).json({
          success: false,
          message: "No items to import."
        });
      }

      const result = await AutoUpdateService.process(data);

      return res.status(200).json({
        success: true,
        result
      });

    } catch (error: any) {

      console.error(error);

      return res.status(500).json({
        success: false,
        message: error.message
      });

    }
  }
}