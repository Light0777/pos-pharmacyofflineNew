import { Request, Response } from "express";
import { ExcelReader } from "../modules/importer/readers/excel.reader";

const reader = new ExcelReader();

export class ImportController {
  static async importExcel(req: Request & { file?: { path: string } }, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Excel file is required.",
        });
      }

      const rows = await reader.read(req.file.path);

      return res.status(200).json({
        success: true,
        totalRows: rows.length,
        rows,
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