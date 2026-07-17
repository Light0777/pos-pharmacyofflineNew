// __________________________________________________________
// | UPDATE: Added toNumber() helper to strip ₹ $ % ,       |
// | symbols from cell values before parseFloat.             |
// |                                                         |
// | WHY: CSV values like "₹35.00" or "2.5%" cause           |
// | Number() to return NaN → 0 in the preview. This fix     |
// | makes numeric parsing resilient to currency/percent      |
// | symbols commonly found in supplier invoices.             |
// |__________________________________________________________|

import { SupplierInvoiceItem } from "../../../types/supplierInvoice";
import { ImportRow } from "../models/import-row";
import { MappingProfile } from "../models/mapping-profile";

function toNumber(val: any, fallback: number = 0): number {
  if (val == null) return fallback;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[₹$%,]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? fallback : n;
}

export class Mapper {

  map(rows: ImportRow[]): SupplierInvoiceItem[] {

    return rows.map(row => ({

      manufacturer: row.manufacturer ?? null,

      product_name: String(row.product_name ?? "").trim(),

      hsn: row.hsn ?? null,

      batch: row.batch ?? null,

      expiry: row.expiry ?? null,

      qty: toNumber(row.qty, 1),

      free_qty: toNumber(row.free_qty, 0),

      mrp: toNumber(row.mrp, 0),

      rate: toNumber(row.rate ?? row.mrp, 0),

      gst: toNumber(row.gst, 0),

      pack: row.pack ?? null,

      barcode: row.barcode ?? null,
      
      amount: row.amount ?? null,

      sku: row.sku ?? null

    }));

  }

}