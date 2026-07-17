import { SupplierInvoiceItem } from "../../../types/supplierInvoice";
import { ImportRow } from "../models/import-row";
import { MappingProfile } from "../models/mapping-profile";

export class Mapper {
  map(
    rows: ImportRow[],
    profile: MappingProfile
  ): SupplierInvoiceItem[] {
    return rows.map((row) => ({
      manufacturer: row[profile.fields.manufacturer] || undefined,

      product_name: String(row[profile.fields.product_name] ?? "").trim(),

      hsn: row[profile.fields.hsn] || "",

      batch: row[profile.fields.batch] || "",

      expiry: row[profile.fields.expiry] || "",

      qty: Number(row[profile.fields.qty] ?? 0),

      free_qty: Number(row[profile.fields.free_qty] ?? 0),

      mrp: Number(row[profile.fields.mrp] ?? 0),

      rate: Number(row[profile.fields.rate] ?? 0),

      gst: Number(row[profile.fields.gst] ?? 0),

      pack: row[profile.fields.pack] || "",

      barcode: row[profile.fields.barcode] || "",

      sku: row[profile.fields.sku] || "",
    }));
  }
}