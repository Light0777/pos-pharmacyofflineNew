import path from "path";
import { Request, Response } from "express";

import { ExcelReader } from "../modules/importer/readers/excel.reader";
import { CsvReader } from "../modules/importer/readers/csv.reader";

import { Mapper } from "../modules/importer/mapping/mapper";
import { ProfileService } from "../modules/importer/services/preview.service";

const excelReader = new ExcelReader();
const csvReader = new CsvReader();

const mapper = new Mapper();
const profileService = new ProfileService();

export class ImportController {
  static async importFile(
    req: Request & {
      file?: {
        path: string;
        originalname: string;
      };
    },
    res: Response
  ) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Import file is required.",
        });
      }

      const extension = path
        .extname(req.file.originalname)
        .toLowerCase();

      let rows;

      switch (extension) {
        case ".xlsx":
        case ".xls":
          rows = await excelReader.read(req.file.path);
          break;

        case ".csv":
          rows = await csvReader.read(req.file.path);
          break;

        default:
          return res.status(400).json({
            success: false,
            message: "Unsupported file type. Please upload .xlsx, .xls or .csv",
          });
      }

      // Load mapping profile
      const profile = await profileService.getDefault("purchase");

      // Map to SupplierInvoiceItem[]
      const items = mapper.map(rows, profile);

      // Return preview
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
        message: "Failed to import file.",
      });
    }
  }
}