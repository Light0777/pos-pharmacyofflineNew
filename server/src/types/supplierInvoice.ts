export interface SupplierInvoiceItem {
  manufacturer?: string;
  product_name: string;

  hsn?: string;

  batch: string;
  expiry: string;

  qty: number;
  free_qty?: number;

  mrp: number;
  rate: number;

  gst?: number;

  pack?: string;

  barcode?: string;
  sku?: string;
}

export interface AutoUpdateRequest {
  supplier_uuid?: string;

  invoice_number?: string;
  invoice_date?: string;

  items: SupplierInvoiceItem[];
}