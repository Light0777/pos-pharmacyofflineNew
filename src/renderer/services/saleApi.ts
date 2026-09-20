import { apiDelete, apiGet } from "./api";

export interface Sale {
  sale_uuid: string;
  invoice_number: string;
  grand_total: number | string;
  created_at: string;
  customer_name?: string;
  customer_mobile?: string;
  customer?: {
    name: string;
    mobile?: string;
  };
}

export interface Invoice {
  invoice_number?: string;
  sale_uuid?: string;
  created_at?: string;
  date?: string;
  shop?: {
    name: string;
    mobile?: string;
    address?: string;
    gstin?: string;
  };
  customer?: {
    name: string;
    mobile?: string;
  };
  items?: {
    name: string;
    hsn_code?: string;
    qty: number;
    price: number;
    total: number;
    tax_percent: number;
    tax_amount: number;
    cgst: number;
    sgst: number;
  }[];
  summary?: {
    total: number;
    tax: number;
    cgst: number;
    sgst: number;
    grand_total: number;
  };
  payments?: { method: string; amount: number }[];
  discount?: number;
}

export async function getSales(): Promise<Sale[]> {
  const response: any = await apiGet("/sales");
  if (response?.success && Array.isArray(response.data)) return response.data;
  if (Array.isArray(response)) return response;
  return [];
}

export async function getInvoice(saleUUID: string): Promise<Invoice> {
  const response: any = await apiGet(`/sales/${saleUUID}/invoice`);
  // Backend returns { success: true, data: { invoice fields... } }
  return response?.data || response;
}

export async function getNextInvoice(): Promise<string | null> {
  try {
    const response: any = await apiGet("/sales/next-invoice");
    return response?.data?.invoice_number || null;
  } catch {
    return null;
  }
}

export async function deleteSale(saleUuid: string) {
  try {
    const response = await apiDelete(`/sales/${saleUuid}`);
    if (response && !response.success) {
      console.warn('Delete sale failed:', response.error);
    }
    return response;
  } catch (error) {
    console.error('Delete sale error:', error);
    return { success: false, error: 'Delete sale feature not available' };
  }
}