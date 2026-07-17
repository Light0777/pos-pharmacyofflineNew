import { SupplierInvoiceItem } from "../../../types/supplierInvoice";
import { ImportRow } from "../models/import-row";
import { MappingProfile } from "../models/mapping-profile";

export class Mapper {

  map(rows: ImportRow[]): SupplierInvoiceItem[] {

    return rows.map(row => ({

      manufacturer: row.manufacturer ?? null,

      product_name: String(row.product_name ?? "").trim(),

      hsn: row.hsn ?? null,

      batch: row.batch ?? null,

      expiry: row.expiry ?? null,

      qty: Number(row.qty ?? 1),

      free_qty: Number(row.free_qty ?? 0),

      mrp: Number(row.mrp ?? 0),

      rate: Number(row.rate ?? row.mrp ?? 0),

      gst: Number(row.gst ?? 0),

      pack: row.pack ?? null,

      barcode: row.barcode ?? null,
      
      amount: row.amount ?? null,

      sku: row.sku ?? null

    }));

  }

}