export interface Product {
  medicine_type: React.ReactNode | Iterable<React.ReactNode>;
  product_uuid: string;
  name: string;
  price: number;
  stock: number;
  unit: string;
  sku?: string;
  barcode?: string;
  gst_percent?: number;
  hsn_code?: string;
  manufacturer?: string;
  composition?: string;
  description?: string;
  schedule_type?: string;
  prescription_required?: number;
  rack_location?: string;
  category_uuid?: string;
  image?: string;
  discount?: number;
}

export interface BatchRow {
  id: string;
  batch_uuid?: string;
  batch_number: string;
  bottles: string;
  strips: string;
  total_tablets: string;
  manufacture_date: string;
  expiry_date: string;
  ptr: string;
}

export const GST_OPTIONS = [
  { value: "0", label: "0% (Tax Exempt)" },
  { value: "5", label: "5% (Low Rate)" },
  { value: "12", label: "12% (Standard)" },
  { value: "18", label: "18% (Standard)" },
  { value: "28", label: "28% (High Rate)" },
];

export const SCHEDULE_TYPES = [
  { value: "NONE", label: "None (OTC)" },
  { value: "H", label: "Schedule H" },
  { value: "H1", label: "Schedule H1" },
  { value: "X", label: "Schedule X" },
  { value: "G", label: "Schedule G" },
];

export const CATEGORY_OPTIONS = [
  { uuid: "cat-drug",      name: "Drug" },
  { uuid: "cat-generic",   name: "Generic" },
  { uuid: "cat-otc",       name: "OTC" },
  { uuid: "cat-nutra",     name: "Nutraceutical" },
  { uuid: "cat-ayurvedic", name: "Ayurvedic" },
  { uuid: "cat-surgical",  name: "Surgical" },
  { uuid: "cat-fmcg",      name: "FMCG" },
  { uuid: "cat-cosmetic",  name: "Cosmetic" },
];

export const CATEGORY_DEFAULTS: Record<string, { schedule: string; prescription: boolean }> = {
  "cat-drug":      { schedule: "H",    prescription: true },
  "cat-generic":   { schedule: "H",    prescription: true },
  "cat-otc":       { schedule: "NONE", prescription: false },
  "cat-nutra":     { schedule: "NONE", prescription: false },
  "cat-ayurvedic": { schedule: "NONE", prescription: false },
  "cat-surgical":  { schedule: "NONE", prescription: false },
  "cat-fmcg":      { schedule: "NONE", prescription: false },
  "cat-cosmetic":  { schedule: "NONE", prescription: false },
};

export const UNIT_OPTIONS = ["Tablets / Capsules", "Liquids", "Creams / Ointments", "Devices", "Bottled Tablets", "Piece", "Bandage", "General"];

export const EMPTY_FORM = {
  name: "",
  purchase_price: "",
  sku: "",
  barcode: "",
  gst_percent: "12",
  hsn_code: "",
  unit: "Tablet",
  image: "",
  category_uuid: "",
  manufacturer: "",
  composition: "",
  description: "",
  schedule_type: "NONE",
  prescription_required: false,
  rack_location: "",
  discount: "",
  boxes: "",
  strips_per_box: "",
  tablets_per_strip: "",
  extra_tablets: "",
  price_per_box: "",
  price_per_strip: "",
  price_per_tablet: "",
  batch_number: "",
  manufacture_date: "",
  expiry_date: "",
  strips: "",
  bottles: "",
  total_tablets: "",
  ptr: "",
  supplier_uuid: "",
  invoice_number: "",
  invoice_date: "",
  purchase_discount: "",
  purchase_total: "",
};
