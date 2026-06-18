export interface User {
  user_uuid: string;
  name: string;
  email: string;
  password: string;
  role: 'owner' | 'manager' | 'cashier';
  security_question?: string;
  security_answer?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {

  product_uuid: string;

  name: string;

  category_uuid?: string;

  barcode?: string;

  sku?: string;

  manufacturer?: string;

  composition?: string;

  description?: string;

  schedule_type?: string;

  prescription_required?: number;

  rack_location?: string;

  unit: string;

  price: number;

  purchase_price?: number;

  gst_percent: number;

  stock: number;

  hsn_code?: string;

  image?: string;

  discount?: number;

  created_at: string;

  updated_at: string;
}

export interface ProductUnit {

  unit_uuid: string;

  product_uuid: string;

  unit_name: string;

  conversion_factor: number;

  barcode?: string;

  price?: number;

  purchase_price?: number;

  is_base_unit: number;

  created_at: string;
}

export interface ProductUnitCreateInput {

  product_uuid: string;

  unit_name: string;

  conversion_factor: number;

  barcode?: string;

  price?: number;

  purchase_price?: number;

  is_base_unit?: number;
}

export interface ProductAttribute {
  attribute_uuid: string;

  name: string;

  value: string;
}

export interface ProductCreateInput {

  name: string;

  category_uuid?: string;

  barcode?: string;

  sku?: string;

  manufacturer?: string;

  composition?: string;

  description?: string;

  schedule_type?: string;

  prescription_required?: number;

  rack_location?: string;

  unit?: string;

  price: number;

  purchase_price?: number;

  gst_percent?: number;

  stock?: number;

  hsn_code?: string;

  image?: string;

  discount?: number;
}

export interface ProductUpdateInput {

  name?: string;

  category_uuid?: string;

  barcode?: string;

  sku?: string;

  manufacturer?: string;

  composition?: string;

  description?: string;

  schedule_type?: string;

  prescription_required?: number;

  rack_location?: string;

  unit?: string;

  price?: number;

  purchase_price?: number;

  gst_percent?: number;

  stock?: number;

  hsn_code?: string;

  image?: string;

  discount?: number;
}

export interface ProductBatch {

  batch_uuid: string;

  product_uuid: string;

  batch_number: string;

  expiry_date: string;

  manufacture_date?: string | null;

  mrp: number;

  ptr: number;

  rate: number;

  purchase_price: number;

  selling_price: number;

  gst_percent: number;

  quantity: number;

  sold_quantity: number;

  free_quantity: number;

  is_quarantined: number;

  supplier_uuid?: string | null;

  purchase_uuid?: string | null;

  created_at: string;

  updated_at: string;
}

export interface ProductBatchCreateInput {

  product_uuid: string;

  batch_number: string;

  expiry_date: string;

  manufacture_date?: string;

  mrp: number;

  ptr?: number;

  rate?: number;

  purchase_price?: number;

  selling_price?: number;

  gst_percent?: number;

  quantity: number;

  free_quantity?: number;

  supplier_uuid?: string;

  purchase_uuid?: string;
}

export interface ProductSearchParams {
  q?: string;
  barcode?: string;
  sku?: string;
}


// Add these to your existing types

export interface Customer {
  customer_uuid: string;
  name: string;
  mobile?: string;
  address?: string;
  gstin?: string;
  credit_balance: number;
  credit_limit: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerLedger {
  id: number;
  customer_uuid: string;
  type: 'sale' | 'payment' | 'debit' | 'credit';
  amount: number;
  reference_uuid?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerLedgerWithBalance extends CustomerLedger {
  balance: number;
}

export interface CustomerAging {
  name: string;
  credit_balance: number;
  aging: {
    '0_30': number;
    '31_60': number;
    '61_90': number;
    '90_plus': number;
  };
}

export interface CustomerReminder {
  name: string;
  mobile?: string;
  due: number;
  days: number;
}

export interface CustomerSummary {
  total_credit: number;
  customers_with_credit: number;
  top_debtors: Array<{ name: string; credit_balance: number }>;
}

export interface CreditTrendItem {
  month: string;
  total: number;
}

export interface Sale {
  sale_uuid: string;
  invoice_number: string;
  customer_uuid?: string;
  total: number;
  tax: number;
  grand_total: number;
  status: 'completed' | 'refunded' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface SaleItem {
  id: number;
  sale_uuid: string;
  product_uuid: string;
  batch_uuid: string;
  quantity: number;
  price: number;
  tax_percent: number;
  tax_amount: number;
  prescription_required?: number;

  prescription_number?: string;

  doctor_name?: string;

  doctor_license?: string;

  patient_name?: string;

  patient_age?: number;

  patient_gender?: string;

  schedule_type?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: number;
  sale_uuid: string;
  method: 'cash' | 'upi' | 'card' | 'credit';
  amount: number;
  reference?: string;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  purchase_uuid: string;
  total: number;
  supplier_uuid?: string;
  invoice_number?: string;
  invoice_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseItem {
  id: number;
  purchase_uuid: string;
  product_uuid: string;
  batch_number: string;
  expiry_date: string;
  manufacture_date?: string;
  quantity: number;
  free_quantity?: number;
  mrp: number;
  ptr?: number;
  rate?: number;
  cost_price: number;
  selling_price?: number;
  gst_percent?: number;
  unit_uuid?: string;
  discount?: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseWithRelations extends Purchase {
  items: (PurchaseItem & { product?: any })[];
  supplier?: Supplier;
}

export interface StockLedger {
  id: number;
  product_uuid: string;
  quantity: number;
  type: 'purchase' | 'sale' | 'adjustment' | 'return';
  reference_uuid?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  supplier_uuid: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

export interface StockLedger {
  id: number;
  product_uuid: string;
  quantity: number;
  type: 'purchase' | 'sale' | 'adjustment' | 'return';
  reference_uuid?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface Setting {
  id: number;
  shop_name: string;
  mobile?: string;
  address?: string;
  gstin?: string;
  invoice_prefix: string;
  auto_print?: number;
  // =========================
  // PHARMACY COMPLIANCE
  // =========================
  drug_license_number?: string;
  drug_license_valid_upto?: string;
  pharmacist_name?: string;
  pharmacist_registration_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  cart_uuid: string;
  status: 'active' | 'held' | 'completed' | 'cancelled';
  discount: number;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: number;
  cart_uuid: string;
  product_uuid: string;
  unit_uuid: string;
  batch_uuid?: string;
  quantity: number;
  price: number;
  discount: number;
  tax_percent: number;
  created_at: string;
  updated_at: string;
}

export interface CartWithItems extends Cart {
  items: (CartItem & { product?: Product })[];
  summary: CartSummary;
}

export interface CartSummary {
  total: number;
  item_discount: number;
  bill_discount: number;
  tax: number;
  grand_total: number;
}

export type StockAdjustmentType =
  | 'damage'
  | 'expired'
  | 'leakage'
  | 'theft'
  | 'manual'
  | 'supplier_return';

export interface StockAdjustment {

  adjustment_uuid: string;

  product_uuid: string;

  batch_uuid: string;

  adjustment_type: StockAdjustmentType;

  quantity: number;

  note?: string | null;

  performed_by?: string | null;

  created_at: string;

  updated_at: string;
}

export interface CreateStockAdjustmentInput {

  product_uuid: string;

  batch_uuid: string;

  adjustment_type: StockAdjustmentType;

  quantity: number;

  note?: string;

  performed_by?: string;
}

export type MedicineReturnType =
  | 'customer_return'
  | 'supplier_return';

export interface MedicineReturn {

  return_uuid: string;

  sale_uuid?: string | null;

  product_uuid: string;

  batch_uuid: string;

  return_type: MedicineReturnType;

  quantity: number;

  refund_amount: number;

  reason?: string | null;

  performed_by?: string | null;

  created_at: string;

  updated_at: string;
}

export interface CreateMedicineReturnInput {

  sale_uuid?: string;

  product_uuid: string;

  batch_uuid: string;

  return_type: MedicineReturnType;

  quantity: number;

  refund_amount?: number;

  reason?: string;

  performed_by?: string;
}

export interface InvoiceItem {

  product_name: string;

  manufacturer?: string | null;

  hsn_code?: string | null;

  batch_number?: string | null;

  expiry_date?: string | null;

  unit: string;

  quantity: number;

  price: number;

  taxable_amount: number;

  gst_percent: number;

  gst_amount: number;

  cgst: number;

  sgst: number;

  total: number;

  schedule_type?: string | null;

  prescription_required?: number;
  prescription_number?: string | null;
  doctor_name?: string | null;
  doctor_license?: string | null;
  patient_name?: string | null;
  patient_age?: number | null;
  patient_gender?: string | null;
}

export interface InvoiceSummary {

  subtotal: number;

  taxable_total: number;

  gst_total: number;

  cgst_total: number;

  sgst_total: number;

  grand_total: number;
}

export interface PharmacyInvoice {

  invoice_number: string;

  invoice_date: string;

  customer?: {

    name?: string;

    mobile?: string;

    address?: string;

    gstin?: string;
  };

  pharmacy: {

    shop_name: string;

    address?: string;

    mobile?: string;

    gstin?: string;

    drug_license_number?: string;

    pharmacist_name?: string;

    pharmacist_registration_number?: string;
  };

  items: InvoiceItem[];

  summary: InvoiceSummary;

  payments: Payment[];

  compliance: {

    contains_schedule_h: boolean;

    contains_schedule_h1: boolean;

    contains_schedule_x: boolean;

    warnings: string[];
  };
}

export interface H1Register {

  id: number;

  register_uuid: string;

  sale_uuid: string;

  sale_item_id: number;

  product_uuid: string;

  batch_uuid?: string | null;

  prescription_number: string;

  doctor_name: string;

  doctor_license?: string | null;

  patient_name: string;

  patient_age?: number | null;

  patient_gender?: string | null;

  quantity: number;

  schedule_type?: string | null;

  pharmacist_name?: string | null;

  created_at: string;
}

export interface CreateH1RegisterInput {

  sale_uuid: string;

  sale_item_id: number;

  product_uuid: string;

  batch_uuid?: string;

  prescription_number: string;

  doctor_name: string;

  doctor_license?: string;

  patient_name: string;

  patient_age?: number;

  patient_gender?: string;

  quantity: number;

  schedule_type: string;

  pharmacist_name?: string;
}

export type AuditActionType =

  | 'sale_created'
  | 'sale_updated'
  | 'schedule_h1_sale'
  | 'schedule_drug_sale'
  | 'schedule_x_sale'
  | 'batch_quarantined';

export interface AuditLog {

  id: number;

  audit_uuid: string;

  action_type: AuditActionType;

  entity_type: string;

  entity_uuid?: string | null;

  reference_uuid?: string | null;

  user_uuid?: string | null;

  details?: string | null;

  ip_address?: string | null;

  created_at: string;
}

export interface CreateAuditLogInput {

  action_type: AuditActionType;

  entity_type: string;

  entity_uuid?: string;

  reference_uuid?: string;

  user_uuid?: string;

  details?: string;

  ip_address?: string;
}

export interface ProductTemplate {
  template_uuid: string;

  name: string;

  description?: string;

  category_uuid?: string;

  icon?: string;

  defaults_json?: any;

  packaging_json?: any;

  is_active: number;

  created_at: string;

  updated_at: string;
}

export interface ProductTemplateCreateInput {
  name: string;
  description?: string;
  category_uuid?: string;
  icon?: string;
  defaults_json?: any;
  packaging_json?: any;
}

export interface ProductTemplateUpdateInput {
  name?: string;
  description?: string;
  category_uuid?: string;
  icon?: string;
  defaults_json?: any;
  packaging_json?: any;
  is_active?: number;
}