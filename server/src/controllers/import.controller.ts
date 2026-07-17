// __________________________________________________________
// | UPDATE: Removed dead ProfileService call that crashed     |
// | in production.                                            |
// |                                                           |
// | WHY: ProfileService.getDefault("purchase") resolved paths |
// | via process.cwd() which points to a read-only asar dir in |
// | packaged Electron builds, throwing an error. The mapper   |
// | ignored the profile anyway (map() only takes rows), so    |
// | removing it fixes the production crash with no side       |
// | effects.                                                  |
// | Also removed unused ProfileService import.                |
// |__________________________________________________________|

import path from "path";
import { Request, Response } from "express";

import { ExcelReader } from "../modules/importer/readers/excel.reader";
import { CsvReader } from "../modules/importer/readers/csv.reader";

import { Mapper } from "../modules/importer/mapping/mapper";

const excelReader = new ExcelReader();
const csvReader = new CsvReader();

const mapper = new Mapper();

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

      // Map to SupplierInvoiceItem[]
      const items = mapper.map(rows);

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