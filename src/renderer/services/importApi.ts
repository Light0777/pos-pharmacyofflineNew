const BASE_URL = "http://127.0.0.1:3000/api";

function getToken() {
  return localStorage.getItem("token");
}

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

interface UploadPreviewResponse {
  success: boolean;
  data: {
    supplier_uuid: string | null;
    invoice_number: string | null;
    invoice_date: string | null;
    items: SupplierInvoiceItem[];
  };
}

interface AutoUpdateResult {
  success: boolean;
  created: number;
  updated: number;
  errors: Array<{ item: string; error: string }>;
  purchase_uuid?: string;
  message?: string;
  partial?: boolean;
}

export async function uploadImportFile(file: File): Promise<UploadPreviewResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/import/file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  });

  return res.json();
}

export async function confirmAutoUpdate(data: {
  supplier_uuid?: string;
  invoice_number?: string;
  invoice_date?: string;
  items: SupplierInvoiceItem[];
}): Promise<AutoUpdateResult> {
  const res = await fetch(`${BASE_URL}/auto-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(data),
  });

  return res.json();
}
