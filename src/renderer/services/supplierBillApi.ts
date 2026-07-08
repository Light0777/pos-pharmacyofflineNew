import { apiGet, apiPost, apiDelete } from "./api";

export interface SupplierBill {
  bill_uuid: string;
  supplier_uuid: string;
  bill_image?: string;
  created_at: string;
}

export async function getSupplierBills(supplierUuid: string): Promise<SupplierBill[]> {
  const res = await apiGet(`/suppliers/${supplierUuid}/bills`);
  return res.data || [];
}

export async function createSupplierBill(supplierUuid: string, billImage: string) {
  const res = await apiPost(`/suppliers/${supplierUuid}/bills`, { bill_image: billImage });
  return res.data;
}

export async function deleteSupplierBill(billUuid: string) {
  await apiDelete(`/suppliers/bills/${billUuid}`);
}
