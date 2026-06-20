import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import SimpleDatePicker from "../../components/SimpleDatePicker";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductUnits,
  createProductUnit,
  deleteProductUnit,
  getProductBatches,
  createProductBatch,
  updateProductBatch,
  deleteBatch,
  quarantineExpiredBatches,
  searchBatches,
} from "../../renderer/services/productApi";
import { getSuppliers, createSupplier } from "../../renderer/services/supplierApi";
import type { Supplier } from "../../renderer/services/supplierApi";
import { createPurchase, getPurchases, updatePurchase } from "../../renderer/services/purchaseApi";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ────────────────────────────────────────────────────────────────
interface Product {
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

interface BulkRow {
  uuid: string;
  name: string;
  composition: string;
  description: string;
  manufacturer: string;
  price: string;
  purchase_price: string;
  discount: string;
  gst_percent: string;
  schedule_type: string;
  hsn_code: string;
  barcode: string;
  sku: string;
  rack_location: string;
  category_uuid: string;
  prescription_required: boolean;
  unit: string;
  batch_number: string;
  quantity: string;
  manufacture_date: string;
  expiry_date: string;
  supplier_name: string;
  invoice_number: string;
  invoice_date: string;
  purchase_discount: string;
  manual_subtotal: string | null;
}

interface BatchRow {
  id: string;
  batch_uuid?: string;
  batch_number: string;
  strips: string;
  total_tablets: string;
  manufacture_date: string;
  expiry_date: string;
  ptr: string;
}

// ─── Constants ────────────────────────────────────────────────────────────
const GST_OPTIONS = [
  { value: "0", label: "0% (Tax Exempt)" },
  { value: "5", label: "5% (Low Rate)" },
  { value: "12", label: "12% (Standard)" },
  { value: "18", label: "18% (Standard)" },
  { value: "28", label: "28% (High Rate)" },
];

const SCHEDULE_TYPES = [
  { value: "NONE", label: "None (OTC)" },
  { value: "H", label: "Schedule H" },
  { value: "H1", label: "Schedule H1" },
  { value: "X", label: "Schedule X" },
  { value: "G", label: "Schedule G" },
];

const CATEGORY_OPTIONS = [
  { uuid: "cat-drug",      name: "Drug" },
  { uuid: "cat-generic",   name: "Generic" },
  { uuid: "cat-otc",       name: "OTC" },
  { uuid: "cat-nutra",     name: "Nutraceutical" },
  { uuid: "cat-ayurvedic", name: "Ayurvedic" },
  { uuid: "cat-surgical",  name: "Surgical" },
  { uuid: "cat-fmcg",      name: "FMCG" },
  { uuid: "cat-cosmetic",  name: "Cosmetic" },
];

const CATEGORY_DEFAULTS: Record<string, { schedule: string; prescription: boolean }> = {
  "cat-drug":      { schedule: "H",    prescription: true },
  "cat-generic":   { schedule: "H",    prescription: true },
  "cat-otc":       { schedule: "NONE", prescription: false },
  "cat-nutra":     { schedule: "NONE", prescription: false },
  "cat-ayurvedic": { schedule: "NONE", prescription: false },
  "cat-surgical":  { schedule: "NONE", prescription: false },
  "cat-fmcg":      { schedule: "NONE", prescription: false },
  "cat-cosmetic":  { schedule: "NONE", prescription: false },
};

const UNIT_OPTIONS = ["Tablets / Capsules", "Liquids", "Creams / Ointments", "Devices", "Bottle Medicine", "Piece"];

const EMPTY_FORM = {
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
  total_tablets: "",
  ptr: "",
  supplier_uuid: "",
  invoice_number: "",
  invoice_date: "",
  purchase_discount: "",
};

// ─── Reusable UI Components ───────────────────────────────────────────────
const Badge = ({ variant = "default", children, className = "" }: any) => {
  const variants: Record<string, string> = {
    default: "bg-slate-100 text-slate-600",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    danger: "bg-red-50 text-red-700 ring-1 ring-red-200",
    info: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
    schedule: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    otc: "bg-slate-100 text-slate-500",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium tracking-wide ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

const Spinner = ({ size = "sm" }: { size?: "sm" | "lg" }) => (
  <div className={`animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 ${size === "sm" ? "w-4 h-4" : "w-8 h-8"}`} />
);

const Tooltip = ({ children, label }: { children: React.ReactNode; label: string }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-slate-800 text-white text-[11px] rounded-md whitespace-nowrap z-50 pointer-events-none">
          {label}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
};

const Select = ({ value, onChange, options, placeholder }: any) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o: any) => o.value === value);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>{selected?.label || placeholder}</span>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {options.map((opt: any) => (
            <li
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${opt.value === value ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Input = ({ label, required, prefix, ...props }: any) => (
  <div>
    {label && (
      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide text-left">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
    )}
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">{prefix}</span>}
      <input
        {...props}
        className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all hover:border-slate-300 ${prefix ? "pl-7" : ""} ${props.className || ""} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        style={props.type === "number" ? { MozAppearance: "textfield" } : undefined}
      />
    </div>
  </div>
);

const Toggle = ({ checked, onChange, label }: any) => (
  <div className="flex items-center gap-3">
    {label && <span className="text-sm text-slate-600">{label}</span>}
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-blue-500" : "bg-slate-200"}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`}
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  </div>
);


// ─── Reusable Dropdown ────────────────────────────────────────────────────
const Dropdown = ({ label, options, value, onChange, placeholder }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; placeholder?: string }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex h-10 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
        >
          <span className={selected ? "text-slate-800" : "text-slate-400"}>{selected?.label || placeholder || "Select\u2026"}</span>
          <svg className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${opt.value === value ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {opt.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ─── Main Products Component ──────────────────────────────────────────────
export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingBatchUuid, setEditingBatchUuid] = useState<string | null>(null);
  const [editingPurchaseUuid, setEditingPurchaseUuid] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [missClickToast, setMissClickToast] = useState(false);
  const [showPrintLabels, setShowPrintLabels] = useState(false);
  const [mfgShowPicker, setMfgShowPicker] = useState(false);
  const [expiryShowPicker, setExpiryShowPicker] = useState(false);
  const [mfgPickPos, setMfgPickPos] = useState({ top: 0, right: 0 });
  const [expiryPickPos, setExpiryPickPos] = useState({ top: 0, right: 0 });
  const mfgBtnRef = useRef<HTMLButtonElement>(null);
  const expiryBtnRef = useRef<HTMLButtonElement>(null);
  const [invoiceShowPicker, setInvoiceShowPicker] = useState(false);
  const invoiceBtnRef = useRef<HTMLButtonElement>(null);
  const [invoicePickPos, setInvoicePickPos] = useState({ top: 0, right: 0 });
  const [filterFromShowPicker, setFilterFromShowPicker] = useState(false);
  const [filterToShowPicker, setFilterToShowPicker] = useState(false);
  const [filterFromPickPos, setFilterFromPickPos] = useState({ top: 0, right: 0 });
  const [filterToPickPos, setFilterToPickPos] = useState({ top: 0, right: 0 });
  const filterFromBtnRef = useRef<HTMLButtonElement>(null);
  const filterToBtnRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [units, setUnits] = useState<any[]>([]);
  const [unitForm, setUnitForm] = useState({
    unit_name: "",
    conversion_factor: "1",
    barcode: "",
    price: "",
    purchase_price: "",
    is_base_unit: false,
  });
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [batchInfo, setBatchInfo] = useState<Record<string, any>>({});
  const [loadingBatchInfo, setLoadingBatchInfo] = useState<Record<string, boolean>>({});
  const [batchModalProduct, setBatchModalProduct] = useState<{ product_uuid: string; batches: any[] } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showStats, setShowStats] = useState(true);
  const [quarantining, setQuarantining] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ uuid: string; name: string } | { count: number } | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [recentSuppliers, setRecentSuppliers] = useState<Supplier[]>([]);
  const [manualSubtotal, setManualSubtotal] = useState<string | null>(null);
  const [batchRows, setBatchRows] = useState<BatchRow[]>([]);
  const [originalBatchUuids, setOriginalBatchUuids] = useState<string[]>([]);
  const [showNewPurchase, setShowNewPurchase] = useState(false);
  const [newSupplierSearch, setNewSupplierSearch] = useState("");
  const [newSupplierDropdownOpen, setNewSupplierDropdownOpen] = useState(false);
  const [newInvoiceNumber, setNewInvoiceNumber] = useState("");
  const [newInvoiceDate, setNewInvoiceDate] = useState("");
  const [newPurchaseDiscount, setNewPurchaseDiscount] = useState("");
  const [newInvoiceShowPicker, setNewInvoiceShowPicker] = useState(false);
  const [newInvoicePickPos, setNewInvoicePickPos] = useState({ top: 0, right: 0 });
  const newInvoiceBtnRef = useRef<HTMLButtonElement>(null);
  const [newManualSubtotal, setNewManualSubtotal] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [copyBuffer, setCopyBuffer] = useState<Partial<BulkRow> | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ row: BulkRow; x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const bulkTableRef = useRef<HTMLDivElement>(null);

  // Advanced filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    composition: "",
    schedule: "",
    gst: "",
    mrpMin: "",
    mrpMax: "",
    batch: "",
  });
  const [allBatchesMap, setAllBatchesMap] = useState<Record<string, string[]>>({});
  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  const [filterFromDate, setFilterFromDate] = useState<Date | undefined>(undefined);
  const [filterToDate, setFilterToDate] = useState<Date | undefined>(undefined);

  // Load batch data for batch filter (single query)
  useEffect(() => {
    if (!filters.batch) { setAllBatchesMap({}); return; }
    let cancelled = false;
    const loadMatchingBatches = async () => {
      const results = await searchBatches(filters.batch);
      if (cancelled) return;
      const map: Record<string, string[]> = {};
      for (const r of results) {
        if (!map[r.product_uuid]) map[r.product_uuid] = [];
        map[r.product_uuid].push(r.batch_number.toLowerCase());
      }
      setAllBatchesMap(map);
    };
    loadMatchingBatches();
    return () => { cancelled = true; };
  }, [filters.batch]);

  const filteredProducts = useMemo(() => {
    let list = products.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.composition || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.manufacturer || "").toLowerCase().includes(searchTerm.toLowerCase())
    );
    list = list.filter((p) => {
      if (stockFilter === "in") return (p.stock ?? 0) >= 10;
      if (stockFilter === "low") return (p.stock ?? 0) > 0 && (p.stock ?? 0) < 10;
      if (stockFilter === "out") return (p.stock ?? 0) === 0;
      return true;
    });
    // Advanced filters
    if (filters.composition) {
      list = list.filter(p => (p.composition || "").toLowerCase().includes(filters.composition.toLowerCase()));
    }
    if (filters.schedule) {
      list = list.filter(p => p.schedule_type === filters.schedule);
    }
    if (filters.gst) {
      list = list.filter(p => String(p.gst_percent ?? "0") === filters.gst);
    }
    if (filters.mrpMin) {
      list = list.filter(p => (p.price || 0) >= Number(filters.mrpMin));
    }
    if (filters.mrpMax) {
      list = list.filter(p => (p.price || 0) <= Number(filters.mrpMax));
    }
    if (filters.batch) {
      const q = filters.batch.toLowerCase();
      list = list.filter(p => {
        const batches = allBatchesMap[p.product_uuid];
        return batches && batches.some(b => b.includes(q));
      });
    }
    list = [...list].sort((a, b) => {
      let va: any = a[sortField as keyof Product] ?? "";
      let vb: any = b[sortField as keyof Product] ?? "";
      if (typeof va === "number") return sortDir === "asc" ? va - vb : vb - va;
      return sortDir === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
    });
    return list;
  }, [products, searchTerm, stockFilter, sortField, sortDir, filters, allBatchesMap]);

  const [pageP, setPageP] = useState(1);
  const pageSize = 20;
  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice((pageP - 1) * pageSize, pageP * pageSize);

  const formatCompactNumber = (num: number): string => {
    if (num === null || num === undefined) return "0";
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
    if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
    if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
    return num.toFixed(2);
  };

  useEffect(() => {
    setPageP(1);
  }, [searchTerm, stockFilter, sortField, sortDir, filters]);

  useEffect(() => {
    setFilters(prev => ({ ...prev, dateFrom: filterFromDate ? format(filterFromDate, "yyyy-MM-dd") : "" }));
  }, [filterFromDate]);

  useEffect(() => {
    setFilters(prev => ({ ...prev, dateTo: filterToDate ? format(filterToDate, "yyyy-MM-dd") : "" }));
  }, [filterToDate]);

  // Click outside handlers for date pickers
  const pickerHeight = 300;
  useEffect(() => {
    if (!mfgShowPicker || !mfgBtnRef.current) return;
    const rect = mfgBtnRef.current.getBoundingClientRect();
    const fitsBelow = rect.bottom + 4 + pickerHeight <= window.innerHeight;
    setMfgPickPos({
      top: fitsBelow ? rect.bottom + 4 : rect.top - pickerHeight,
      right: document.documentElement.clientWidth - rect.right
    });
    const handler = (e: MouseEvent) => {
      if (mfgBtnRef.current && !mfgBtnRef.current.contains(e.target as Node)) {
        const cal = document.getElementById("mfg-cal-popup");
        if (cal && !cal.contains(e.target as Node)) {
          setMfgShowPicker(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mfgShowPicker]);

  useEffect(() => {
    if (!expiryShowPicker || !expiryBtnRef.current) return;
    const rect = expiryBtnRef.current.getBoundingClientRect();
    const fitsBelow = rect.bottom + 4 + pickerHeight <= window.innerHeight;
    setExpiryPickPos({
      top: fitsBelow ? rect.bottom + 4 : rect.top - pickerHeight,
      right: document.documentElement.clientWidth - rect.right
    });
    const handler = (e: MouseEvent) => {
      if (expiryBtnRef.current && !expiryBtnRef.current.contains(e.target as Node)) {
        const cal = document.getElementById("expiry-cal-popup");
        if (cal && !cal.contains(e.target as Node)) {
          setExpiryShowPicker(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expiryShowPicker]);

  useEffect(() => {
    if (!invoiceShowPicker || !invoiceBtnRef.current) return;
    const rect = invoiceBtnRef.current.getBoundingClientRect();
    const fitsBelow = rect.bottom + 4 + pickerHeight <= window.innerHeight;
    setInvoicePickPos({
      top: fitsBelow ? rect.bottom + 4 : rect.top - pickerHeight,
      right: document.documentElement.clientWidth - rect.right
    });
    const handler = (e: MouseEvent) => {
      if (invoiceBtnRef.current && !invoiceBtnRef.current.contains(e.target as Node)) {
        const cal = document.getElementById("inv-cal-popup");
        if (cal && !cal.contains(e.target as Node)) {
          setInvoiceShowPicker(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [invoiceShowPicker]);

  useEffect(() => {
    if (!filterFromShowPicker || !filterFromBtnRef.current) return;
    const rect = filterFromBtnRef.current.getBoundingClientRect();
    const fitsBelow = rect.bottom + 4 + pickerHeight <= window.innerHeight;
    setFilterFromPickPos({
      top: fitsBelow ? rect.bottom + 4 : rect.top - pickerHeight,
      right: document.documentElement.clientWidth - rect.right
    });
    const handler = (e: MouseEvent) => {
      if (filterFromBtnRef.current && !filterFromBtnRef.current.contains(e.target as Node)) {
        const cal = document.getElementById("filter-from-cal-popup");
        if (cal && !cal.contains(e.target as Node)) {
          setFilterFromShowPicker(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterFromShowPicker]);

  useEffect(() => {
    if (!filterToShowPicker || !filterToBtnRef.current) return;
    const rect = filterToBtnRef.current.getBoundingClientRect();
    const fitsBelow = rect.bottom + 4 + pickerHeight <= window.innerHeight;
    setFilterToPickPos({
      top: fitsBelow ? rect.bottom + 4 : rect.top - pickerHeight,
      right: document.documentElement.clientWidth - rect.right
    });
    const handler = (e: MouseEvent) => {
      if (filterToBtnRef.current && !filterToBtnRef.current.contains(e.target as Node)) {
        const cal = document.getElementById("filter-to-cal-popup");
        if (cal && !cal.contains(e.target as Node)) {
          setFilterToShowPicker(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterToShowPicker]);

  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock <= 10 && p.stock > 0).length;
  const outOfStockProducts = products.filter((p) => p.stock === 0).length;
  const totalInventoryValue = products.reduce((sum, p) => sum + (p.price || 0) * (p.stock || 0), 0);

  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const trendData = useMemo(() => {
    const gen = (peak: number) => {
      const pts: number[] = [];
      for (let i = 0; i < 20; i++) {
        const base = (i / 19) * peak;
        pts.push(Math.max(0, Math.round(base * (0.7 + ((i * 7 + 13) % 10) / 20))));
      }
      return pts;
    };
    return {
      products: gen(totalProducts),
      inventory: gen(totalInventoryValue),
      low: gen(lowStockProducts),
      out: gen(outOfStockProducts),
    };
  }, [totalProducts, totalInventoryValue, lowStockProducts, outOfStockProducts]);

  const Sparkline = ({ data: chartData, width = 320, height = 100, color = "#22c55e" }: { data: number[], width?: number, height?: number, color?: string }) => {
    const [hovered, setHovered] = useState(false);
    if (!chartData || chartData.length < 2) return null;
    const values = chartData;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const points = values.map((v: number, i: number) => ({
      x: i / (values.length - 1) * width,
      y: 4 + (height - 8) * (1 - (v - min) / range),
    }));
    const smoothPath = (pts: { x: number; y: number }[]) => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1], p1 = pts[i], p_1 = pts[Math.max(0, i - 2)], p2 = pts[Math.min(pts.length - 1, i + 1)];
        d += ` C ${p0.x + (p1.x - p_1.x) / 6},${p0.y + (p1.y - p_1.y) / 6} ${p1.x - (p2.x - p0.x) / 6},${p1.y - (p2.y - p0.y) / 6} ${p1.x},${p1.y}`;
      }
      return d;
    };
    const lineD = smoothPath(points);
    const areaD = `${lineD} L ${width},${height} L 0,${height} Z`;
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={hovered ? 0.55 : 0.38} />
            <stop offset="100%" stopColor={color} stopOpacity={hovered ? 0.06 : 0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#sg-${color.replace('#','')})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth={hovered ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke-width 0.15s' }} />
      </svg>
    );
  };

  // Data fetching (unchanged)
  const loadProducts = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { products } = await getProducts(1, 5000);
      setProducts(products);
    } catch (err) {
      console.error("Load products error:", err);
      setError(t("products.loadError"));
      setProducts([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadUnits = async (product_uuid: string) => {
    const data = await getProductUnits(product_uuid);
    setUnits(data);
  };

  const [showQuarantineConfirm, setShowQuarantineConfirm] = useState(false);

  const handleQuarantineExpired = async () => {
    setShowQuarantineConfirm(true);
  };

  const confirmQuarantine = async () => {
    setShowQuarantineConfirm(false);
    setQuarantining(true);
    try {
      const result = await quarantineExpiredBatches();
      if (result?.success !== false) {
        setSuccess("Expired batches quarantined successfully!");
      } else {
        setError(result?.error || "Quarantine failed");
      }
      await loadProducts(true);
    } catch (err) {
      setError("Failed to quarantine expired batches");
    } finally {
      setQuarantining(false);
    }
  };

  const loadBatchInfo = async (product_uuid: string) => {
    if (batchInfo[product_uuid] || loadingBatchInfo[product_uuid]) return;
    setLoadingBatchInfo((prev) => ({ ...prev, [product_uuid]: true }));
    try {
      const batches = await getProductBatches(product_uuid);
      const activeBatches = batches.filter((b: any) => {
        return (b.quantity || 0) > 0 && new Date(b.expiry_date) > new Date();
      });
      const totalAvailable = activeBatches.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0);
      const nearestExpiry = activeBatches.length > 0
        ? activeBatches.sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime())[0]
        : null;
      const expiredBatches = batches.filter((b: any) => {
        return new Date(b.expiry_date) <= new Date() && (b.quantity || 0) > 0;
      });
      setBatchInfo((prev) => ({
        ...prev,
        [product_uuid]: {
          hasBatches: activeBatches.length > 0,
          batchCount: activeBatches.length,
          totalAvailable,
          nearestExpiry: nearestExpiry?.expiry_date,
          nearestExpiryDays: nearestExpiry
            ? Math.ceil((new Date(nearestExpiry.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
            : null,
          hasExpiredStock: expiredBatches.length > 0,
          expiredCount: expiredBatches.length,
        },
      }));
    } catch (err) {
      console.error("Failed to load batch info:", err);
    } finally {
      setLoadingBatchInfo((prev) => ({ ...prev, [product_uuid]: false }));
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    const ids = new Set(paginatedProducts.map((p) => p.product_uuid));
    for (const id of ids) {
      if (!batchInfo[id] && !loadingBatchInfo[id]) loadBatchInfo(id);
    }
  }, [paginatedProducts]);

  useEffect(() => {
    if (editing?.product_uuid) {
      loadUnits(editing.product_uuid);
    } else {
      setUnits([]);
    }
  }, [editing]);

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("keydown", keyHandler); };
  }, [ctxMenu]);

  useEffect(() => {
    if (!showBulkModal) return;
    const el = bulkTableRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      const tr = (e.target as HTMLElement).closest("tr");
      if (!tr) return;
      const idx = Array.from(tr.parentElement!.children).indexOf(tr);
      const row = bulkRows[idx];
      if (!row) return;
      const mx = e.clientX, my = e.clientY;
      setCtxMenu({ row, x: Math.min(mx, window.innerWidth - 168), y: Math.min(my, window.innerHeight - 208) });
    };
    el.addEventListener("contextmenu", handler);
    return () => el.removeEventListener("contextmenu", handler);
  }, [showBulkModal, bulkRows]);

  useEffect(() => {
    getSuppliers().then((data) => {
      const list = Array.isArray(data) ? data : [];
      setSuppliers(list);
      // Load recent suppliers from localStorage
      try {
        const stored = localStorage.getItem("recent_suppliers");
        if (stored) {
          const uuids: string[] = JSON.parse(stored);
          const recent = uuids.map((uuid) => list.find((s) => s.supplier_uuid === uuid)).filter(Boolean) as Supplier[];
          setRecentSuppliers(recent);
        }
      } catch (e) {}
    }).catch(() => {});
  }, []);

  // Handlers
  const handleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: string }) => (
    <svg
      className={`w-3 h-3 ml-1 transition-colors ${sortField === field ? "text-blue-500" : "text-slate-300"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      {sortField === field && sortDir === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );

  const toggleRow = (uuid: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === filteredProducts.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(filteredProducts.map((p) => p.product_uuid)));
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setSupplierSearch("");
    setShowNewPurchase(false);
    setNewSupplierSearch("");
    setNewInvoiceNumber("");
    setNewInvoiceDate("");
    setNewPurchaseDiscount("");
    setNewManualSubtotal(null);
    setForm({
      name: p.name || "",
      purchase_price: String(p.purchase_price || ""),
      sku: p.sku || "",
      barcode: p.barcode || "",
      gst_percent: String(p.gst_percent ?? "0"),
      hsn_code: p.hsn_code || "",
      unit: p.unit || "Tablet",
      image: p.image || "",
      category_uuid: p.category_uuid || "",
      manufacturer: p.manufacturer || "",
      composition: p.composition || "",
      description: p.description || "",
      schedule_type: p.schedule_type || "NONE",
      prescription_required: Boolean(p.prescription_required),
      rack_location: p.rack_location || "",
      discount: p.discount ? String(p.discount) : "",
      boxes: String(p.boxes ?? ""),
      strips_per_box: String(p.strips_per_box ?? ""),
      tablets_per_strip: String(p.tablets_per_strip ?? ""),
      extra_tablets: String(p.extra_tablets ?? ""),
      price_per_box: String(p.price_per_box ?? ""),
      price_per_strip: String(p.price_per_strip ?? ""),
      price_per_tablet: String(p.price_per_tablet ?? ""),
      batch_number: "", strips: "", total_tablets: "", manufacture_date: "", expiry_date: "", ptr: "",
      purchase_discount: "", supplier_uuid: "", invoice_number: "", invoice_date: "",
    });
    // Load batch data into form & store active batch UUID
    getProductBatches(p.product_uuid).then((batches) => {
      const all = batches || [];
      const active = all.filter((b: any) => (b.quantity || 0) > 0);
      setEditingBatchUuid(active.length > 0 ? active[0].batch_uuid : null);
      setEditingPurchaseUuid(all[0]?.purchase_uuid || null);
      setOriginalBatchUuids(all.map((b: any) => b.batch_uuid).filter(Boolean));
      const tsp = Number(p.tablets_per_strip) || 1;
      if (active.length > 0) {
        const b = active[0];
        const stripVal = String(b.strips || (b.quantity ? Math.round(b.quantity / tsp) : 0) || 0);
        const tabletVal = String((Number(stripVal) || 0) * (Number(p.tablets_per_strip) || 0) + (Number(p.extra_tablets) || 0));
        const updates: any = {
          batch_number: b.batch_number || "",
          strips: stripVal,
          total_tablets: tabletVal,
          ptr: String(b.ptr ?? b.purchase_price ?? ""),
          manufacture_date: b.manufacture_date || "",
          expiry_date: b.expiry_date || "",
        };
        if (b.supplier_uuid) updates.supplier_uuid = b.supplier_uuid;
        setForm((prev) => ({ ...prev, ...updates }));
      }
      // Fill additional batch rows with remaining active batches
      const extra = active.slice(1).map((b: any, i: number) => ({
        id: `batch-edit-${i}`,
        batch_uuid: b.batch_uuid,
        batch_number: b.batch_number || "",
        strips: String(b.strips || (b.quantity ? Math.round(b.quantity / tsp) : 0) || 0),
        total_tablets: String(b.quantity || 0),
        ptr: String(b.ptr ?? b.purchase_price ?? ""),
        manufacture_date: b.manufacture_date || "",
        expiry_date: b.expiry_date || "",
      }));
      if (extra.length > 0) setBatchRows(extra);
      // Try to get purchase info — find the LATEST purchase across all batches
      const purchaseUuids = [...new Set(all.map((b: any) => b.purchase_uuid).filter(Boolean))];
      if (purchaseUuids.length > 0) {
        getPurchases().then((purchases) => {
          const list = Array.isArray(purchases) ? purchases : [];
          const matched = list
            .filter((pch: any) => purchaseUuids.includes(pch.purchase_uuid))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const latest = matched[0];
          if (latest) {
            setForm((prev) => ({
              ...prev,
              supplier_uuid: latest.supplier_uuid || prev.supplier_uuid,
              invoice_number: latest.invoice_number || "",
              invoice_date: latest.invoice_date || "",
              purchase_discount: latest.discount ? String(latest.discount) : "",
            }));
            // Set supplierSearch for read-only display
            if (latest.supplier_uuid) {
              const supplier = suppliers.find((s) => s.supplier_uuid === latest.supplier_uuid);
              if (supplier) setSupplierSearch(supplier.name);
            }
          }
        }).catch(() => {});
      }
    }).catch(() => { setEditingBatchUuid(null); setEditingPurchaseUuid(null); });
    setShowForm(true);
  };

  const handleDelete = async (uuid: string) => {
    const product = products.find((p) => p.product_uuid === uuid);
    setDeleteConfirm({ uuid, name: product?.name || "this product" });
  };

  const confirmDelete = async (target: { uuid: string } | { count: number }) => {
    setDeleteConfirm(null);
    if ("uuid" in target) {
      setDeleting(target.uuid);
      try {
        await deleteProduct(target.uuid);
        await loadProducts(true);
        setSuccess("Product deleted successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        console.error("Delete error:", err);
        setError(t("products.deleteError"));
      } finally {
        setDeleting(null);
      }
    } else {
      for (const uuid of selectedRows) {
        await deleteProduct(uuid);
      }
      await loadProducts(true);
      setSelectedRows(new Set());
      setSuccess("Selected products deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const createEmptyBulkRow = (): BulkRow => ({
    uuid: crypto.randomUUID(),
    name: "", composition: "", description: "", manufacturer: "",
    price: "", purchase_price: "", discount: "", gst_percent: "12",
    schedule_type: "NONE", hsn_code: "", barcode: "", sku: "",
    rack_location: "", category_uuid: "", prescription_required: false,
    unit: "Strip", batch_number: "", quantity: "", manufacture_date: "",
    expiry_date: "", supplier_name: "", invoice_number: "", invoice_date: "",
    purchase_discount: "", manual_subtotal: null,
  });

  const updateBulkRow = (uuid: string, updates: Partial<BulkRow>) => {
    setBulkRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, ...updates } : r)));
  };

  const removeBulkRow = (uuid: string) => {
    setBulkRows((prev) => prev.filter((r) => r.uuid !== uuid));
  };

  const addBulkRow = () => {
    setBulkRows((prev) => [...prev, createEmptyBulkRow()]);
  };

  const addBatchRow = () => {
    setBatchRows((prev) => [...prev, {
      id: `batch-${Date.now()}`,
      batch_number: "",
      strips: "",
      total_tablets: "",
      ptr: "",
      manufacture_date: "",
      expiry_date: "",
    }]);
  };

  const removeBatchRow = (id: string) => {
    setBatchRows((prev) => prev.filter((r) => r.id !== id));
  };

  const updateBatchRow = (id: string, field: string, value: string) => {
    setBatchRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      if (field === "total_tablets") {
        updated.strips = String(Math.round((Number(value) || 0) / ((Number(form.tablets_per_strip) || 0) || 1)));
      }
      return updated;
    }));
  };

  const handleBulkSubmit = async () => {
    const valid = bulkRows.filter((r) => r.name.trim());
    if (valid.length === 0) { setError("At least one product needs a name."); return; }
    setBulkSubmitting(true);
    setBulkProgress({ current: 0, total: valid.length });
    let successCount = 0;
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      setBulkProgress({ current: i + 1, total: valid.length });
      try {
        const payload: any = {
          name: row.name,
          price: Number(row.price) || 0,
          sku: row.sku || undefined,
          barcode: row.barcode || undefined,
          gst_percent: Number(row.gst_percent) || 0,
          hsn_code: row.hsn_code || undefined,
          unit: row.unit || "Tablet",
          category_uuid: row.category_uuid || undefined,
          manufacturer: row.manufacturer || undefined,
          composition: row.composition || undefined,
          description: row.description || undefined,
          schedule_type: row.schedule_type || "NONE",
          prescription_required: row.prescription_required ? 1 : 0,
          rack_location: row.rack_location || undefined,
        };
        if (row.purchase_price) payload.purchase_price = Number(row.purchase_price);
        if (row.discount) payload.discount = Number(row.discount);
        const created = await createProduct(payload);
        await createProductUnit({
          product_uuid: created.product_uuid,
          unit_name: row.unit || "Tablet",
          conversion_factor: 1,
          is_base_unit: true,
        });
        const matchedSupplier = row.supplier_name ? suppliers.find((s) => s.name.toLowerCase() === row.supplier_name.toLowerCase()) : null;
        if (matchedSupplier) {
          await createPurchase({
            supplier_uuid: matchedSupplier.supplier_uuid,
            invoice_number: row.invoice_number || undefined,
            invoice_date: row.invoice_date || undefined,
            discount: Number(row.purchase_discount) || 0,
            items: [{
              product_uuid: created.product_uuid,
              batch_number: row.batch_number || "BATCH-001",
              manufacture_date: row.manufacture_date || undefined,
              expiry_date: row.expiry_date || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0],
              quantity: Number(row.quantity) || 0,
              mrp: Number(row.price) || 0,
              cost_price: Number(row.purchase_price) || Number(row.price) || 0,
            }],
          });
        } else if (row.batch_number) {
          await createProductBatch({
            product_uuid: created.product_uuid,
            batch_number: row.batch_number,
            manufacture_date: row.manufacture_date || undefined,
            expiry_date: row.expiry_date,
            quantity: Number(row.quantity) || 0,
          });
        }
        successCount++;
      } catch (err) {
        console.error(`Bulk row ${i + 1} failed:`, err);
      }
    }
    setBulkSubmitting(false);
    setShowBulkModal(false);
    await loadProducts();
    window.dispatchEvent(new CustomEvent('stock-updated'));
    setSuccess(`${successCount} of ${valid.length} products created successfully!`);
    setTimeout(() => setSuccess(null), 5000);
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditing(null);
    setShowForm(false);
    setShowUnitForm(false);
    setManualSubtotal(null);
    setBatchRows([]);
    setOriginalBatchUuids([]);
    setShowNewPurchase(false);
    setNewSupplierSearch("");
    setNewSupplierDropdownOpen(false);
    setNewInvoiceNumber("");
    setNewInvoiceDate("");
    setNewPurchaseDiscount("");
    setNewManualSubtotal(null);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      setError("Product name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isSimple = ["Liquids", "Creams / Ointments", "Devices"].includes(form.unit);
      const tsp = Number(form.tablets_per_strip) || (isSimple ? 1 : 0);
      const payload: any = {
        name: form.name,
        price: Number(form.price_per_tablet) || 0,
        sku: form.sku || undefined,
        barcode: form.barcode || undefined,
        gst_percent: Number(form.gst_percent) || 0,
        hsn_code: form.hsn_code || undefined,
        unit: form.unit || "Tablet",
        image: form.image || undefined,
        category_uuid: form.category_uuid || undefined,
        manufacturer: form.manufacturer || undefined,
        composition: form.composition || undefined,
        description: form.description || undefined,
        schedule_type: form.schedule_type || "NONE",
        prescription_required: form.prescription_required ? 1 : 0,
        rack_location: form.rack_location || undefined,
      };
      if (form.purchase_price) payload.purchase_price = Number(form.purchase_price);
      if (form.discount) payload.discount = Number(form.discount);
      if (isSimple) {
        payload.boxes = 0; payload.strips_per_box = 0; payload.tablets_per_strip = 0; payload.extra_tablets = 0;
        payload.price_per_box = 0; payload.price_per_strip = 0; payload.price_per_tablet = Number(form.price_per_tablet) || 0;
      } else {
        if (form.boxes) payload.boxes = Number(form.boxes);
        if (form.strips_per_box) payload.strips_per_box = Number(form.strips_per_box);
        if (form.tablets_per_strip) payload.tablets_per_strip = Number(form.tablets_per_strip);
        if (form.extra_tablets) payload.extra_tablets = Number(form.extra_tablets);
        if (form.price_per_box) payload.price_per_box = Number(form.price_per_box);
        if (form.price_per_strip) payload.price_per_strip = Number(form.price_per_strip);
        if (form.price_per_tablet) payload.price_per_tablet = Number(form.price_per_tablet);
      }
        const computeBatchQty = (strips: string) => (Number(strips) || 0) * tsp;
        const batchPtr = (ptr: string) => Number(ptr) || 0;
        const createSingleBatch = (puuid: string, bn: string, strips: string, ptr: string, mfg: string | undefined, exp: string | undefined) =>
          createProductBatch({ product_uuid: puuid, batch_number: bn, manufacture_date: mfg, expiry_date: exp || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0], quantity: computeBatchQty(strips), ptr: batchPtr(ptr), purchase_price: batchPtr(ptr), mrp: Number(form.price_per_tablet) || 0 });

        if (editing) {
          await updateProduct(editing.product_uuid, payload);
          // Sync product_units — delete all and recreate with current prices
          const existingUnits = await getProductUnits(editing.product_uuid);
          for (const u of existingUnits) await deleteProductUnit(u.unit_uuid);
          const baseUnitName = form.unit || "Tablet";
          const spb = Number(form.strips_per_box) || 0;
          const tps = Number(form.tablets_per_strip) || (isSimple ? 1 : 0);
          const ppb = Number(form.price_per_box) || 0;
          const pps = Number(form.price_per_strip) || 0;
          const ppt = Number(form.price_per_tablet) || 0;
          await createProductUnit({ product_uuid: editing.product_uuid, unit_name: baseUnitName, conversion_factor: 1, is_base_unit: true, price: ppt || undefined });
          if (!isSimple && tps > 0) {
            await createProductUnit({ product_uuid: editing.product_uuid, unit_name: "Strip", conversion_factor: tps, is_base_unit: false, price: pps || undefined });
          }
          if (!isSimple && Number(form.boxes) > 0 && spb > 0 && tps > 0) {
            await createProductUnit({ product_uuid: editing.product_uuid, unit_name: "Box", conversion_factor: spb * tps, is_base_unit: false, price: ppb || undefined });
          }
          // If new purchase details were added, create a purchase linking all batches
          if (showNewPurchase && form.supplier_uuid) {
            const purchaseBatches: Array<{ batch_number: string; batch_uuid?: string; strips: string; ptr: string; manufacture_date: string | undefined; expiry_date: string | undefined }> = [];
            if (form.batch_number || form.strips) {
              purchaseBatches.push({ batch_number: form.batch_number || "BATCH-" + Date.now(), batch_uuid: editingBatchUuid || undefined, strips: form.strips, ptr: form.ptr, manufacture_date: form.manufacture_date || undefined, expiry_date: form.expiry_date || undefined });
            }
            for (const row of batchRows) {
              if (row.batch_number) {
                purchaseBatches.push({ batch_number: row.batch_number, batch_uuid: row.batch_uuid || undefined, strips: row.strips, ptr: row.ptr, manufacture_date: row.manufacture_date || undefined, expiry_date: row.expiry_date || undefined });
              }
            }
            if (purchaseBatches.length > 0) {
              await createPurchase({
                supplier_uuid: form.supplier_uuid,
                invoice_number: newInvoiceNumber || undefined,
                invoice_date: newInvoiceDate || undefined,
                discount: Number(newPurchaseDiscount) || 0,
                items: purchaseBatches.map(b => ({ product_uuid: editing.product_uuid, batch_uuid: b.batch_uuid, batch_number: b.batch_number, manufacture_date: b.manufacture_date, expiry_date: b.expiry_date || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0], quantity: computeBatchQty(b.strips), strips: Number(b.strips) || 0, ptr: batchPtr(b.ptr), cost_price: batchPtr(b.ptr), mrp: Number(form.price_per_tablet) || 0 })),
              });
            }
          }
          // Update/create first batch (skip standalone creation if handled by new purchase above)
          if (form.batch_number || form.strips || form.manufacture_date || form.expiry_date || form.supplier_uuid) {
            if (editingBatchUuid) {
              const batchUpdates: Record<string, any> = {};
              if (form.batch_number) batchUpdates.batch_number = form.batch_number;
              if (form.strips) batchUpdates.strips = Number(form.strips);
              if (form.strips) batchUpdates.quantity = computeBatchQty(form.strips);
              if (form.ptr) batchUpdates.ptr = batchPtr(form.ptr);
              if (form.ptr) batchUpdates.purchase_price = batchPtr(form.ptr);
              if (form.manufacture_date) batchUpdates.manufacture_date = form.manufacture_date;
              if (form.expiry_date) batchUpdates.expiry_date = form.expiry_date;
              if (form.supplier_uuid) batchUpdates.supplier_uuid = form.supplier_uuid;
              await updateProductBatch(editingBatchUuid, batchUpdates);
            } else if ((form.batch_number || form.strips) && !(showNewPurchase && form.supplier_uuid)) {
              await createSingleBatch(editing.product_uuid, form.batch_number || "BATCH-" + Date.now(), form.strips, form.ptr, form.manufacture_date || undefined, form.expiry_date || undefined);
            }
          }
          // Create/update additional batches (skip standalone creation if handled by new purchase above)
          for (const row of batchRows) {
            if (!row.batch_number) continue;
            if (row.batch_uuid) {
              await updateProductBatch(row.batch_uuid, {
                batch_number: row.batch_number,
                strips: Number(row.strips) || 0,
                quantity: computeBatchQty(row.strips),
                ptr: batchPtr(row.ptr),
                purchase_price: batchPtr(row.ptr),
                manufacture_date: row.manufacture_date || undefined,
                expiry_date: row.expiry_date || undefined,
                mrp: Number(form.price_per_tablet) || 0,
              });
            } else if (!(showNewPurchase && form.supplier_uuid)) {
              await createSingleBatch(editing.product_uuid, row.batch_number, row.strips, row.ptr, row.manufacture_date || undefined, row.expiry_date || undefined);
            }
          }
          // Delete batches removed from UI
          const currentUuids = [editingBatchUuid, ...batchRows.map(r => r.batch_uuid)].filter(Boolean);
          for (const uuid of originalBatchUuids) {
            if (!currentUuids.includes(uuid)) {
              try { await deleteBatch(uuid); } catch (e) { console.error("Failed to delete batch", uuid, e); }
            }
          }
          // Update purchase record if linked
          if (editingPurchaseUuid && (form.invoice_number || form.invoice_date || form.purchase_discount || form.supplier_uuid)) {
            const purchaseUpdates: Record<string, any> = {};
            if (form.invoice_number) purchaseUpdates.invoice_number = form.invoice_number;
            if (form.invoice_date) purchaseUpdates.invoice_date = form.invoice_date;
            if (form.purchase_discount) purchaseUpdates.discount = Number(form.purchase_discount);
            if (form.supplier_uuid) purchaseUpdates.supplier_uuid = form.supplier_uuid;
            await updatePurchase(editingPurchaseUuid, purchaseUpdates);
          }
        } else {
          const created = await createProduct(payload);
          const baseUnitName = form.unit || "Tablet";
          const spb = Number(form.strips_per_box) || 0;
          const tps = Number(form.tablets_per_strip) || (isSimple ? 1 : 0);
          const ppb = Number(form.price_per_box) || 0;
          const pps = Number(form.price_per_strip) || 0;
          const ppt = Number(form.price_per_tablet) || 0;
          await createProductUnit({ product_uuid: created.product_uuid, unit_name: baseUnitName, conversion_factor: 1, is_base_unit: true, price: ppt || undefined });
          if (!isSimple && tps > 0) {
            await createProductUnit({ product_uuid: created.product_uuid, unit_name: "Strip", conversion_factor: tps, is_base_unit: false, price: pps || undefined });
          }
          if (!isSimple && Number(form.boxes) > 0 && spb > 0 && tps > 0) {
            await createProductUnit({ product_uuid: created.product_uuid, unit_name: "Box", conversion_factor: spb * tps, is_base_unit: false, price: ppb || undefined });
          }
          // Collect all batch rows (first form batch + additional)
          const allBatches = [
            { bn: form.batch_number, strips: form.strips, ptr: form.ptr, mfg: form.manufacture_date || undefined, exp: form.expiry_date || undefined },
            ...batchRows.filter(r => r.batch_number).map(r => ({ bn: r.batch_number, strips: r.strips, ptr: r.ptr, mfg: r.manufacture_date || undefined, exp: r.expiry_date || undefined })),
          ].filter(b => b.bn);
          // Create purchase if supplier is selected (purchase model creates the batch)
          if (form.supplier_uuid && allBatches.length > 0) {
            await createPurchase({
              supplier_uuid: form.supplier_uuid,
              invoice_number: form.invoice_number || undefined,
              invoice_date: form.invoice_date || undefined,
              discount: Number(form.purchase_discount) || 0,
              items: allBatches.map(b => ({ product_uuid: created.product_uuid, batch_number: b.bn, manufacture_date: b.mfg, expiry_date: b.exp, quantity: computeBatchQty(b.strips), strips: Number(b.strips) || 0, ptr: batchPtr(b.ptr), cost_price: batchPtr(b.ptr), mrp: Number(form.price_per_tablet) || 0 })),
            });
          } else {
            for (const b of allBatches) {
              await createSingleBatch(created.product_uuid, b.bn, b.strips, b.ptr, b.mfg, b.exp);
            }
          }
        }
      resetForm();
      // Clear cached batch info so it refreshes
      if (editing?.product_uuid) setBatchInfo((prev: any) => { const n = { ...prev }; delete n[editing.product_uuid]; return n; });
      setEditingBatchUuid(null);
      setEditingPurchaseUuid(null);
      await loadProducts();
      window.dispatchEvent(new CustomEvent('stock-updated'));
      setSuccess(editing ? "Product updated successfully!" : "Product created successfully!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Submit error:", err);
      setError(editing ? t("products.updateError") : t("products.createError"));
    } finally {
      setLoading(false);
    }
  };

  const handleAddUnit = async () => {
    if (!editing?.product_uuid) return;
    if (!unitForm.unit_name || !unitForm.conversion_factor) return;
    try {
      await createProductUnit({
        product_uuid: editing.product_uuid,
        unit_name: unitForm.unit_name,
        conversion_factor: Number(unitForm.conversion_factor),
        barcode: unitForm.barcode || undefined,
        price: unitForm.price ? Number(unitForm.price) : undefined,
        purchase_price: unitForm.purchase_price ? Number(unitForm.purchase_price) : undefined,
        is_base_unit: unitForm.is_base_unit,
      });
      setUnitForm({
        unit_name: "",
        conversion_factor: "1",
        barcode: "",
        price: "",
        purchase_price: "",
        is_base_unit: false,
      });
      setShowUnitForm(false);
      await loadUnits(editing.product_uuid);
      setSuccess("Pack size added successfully!");
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error("Add unit error:", err);
      setError("Failed to add pack size");
    }
  };

  const handleDeleteUnit = async (unit_uuid: string) => {
    if (!editing?.product_uuid) return;
    await deleteProductUnit(unit_uuid);
    await loadUnits(editing.product_uuid);
  };

  if (loading && !products.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size="lg" />
      </div>
    );
  }

  const isSimpleType = ["Liquids", "Creams / Ointments", "Devices", "Piece"].includes(form.unit);
  const isBottleMedicine = form.unit === "Bottle Medicine";
  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">


      {/* Flash Messages */}
      <div className="space-y-2">
        {success && (
          <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      {showStats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('products')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
<p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.totalProducts')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{totalProducts}</p>
            <p className="text-xs text-gray-500 mt-1">{t('products.allRegisteredMedicines')}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('inventory')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.inventoryValue')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">₹{formatCompactNumber(totalInventoryValue)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('products.currentStockValue')}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('low')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.lowStock')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{lowStockProducts}</p>
            <p className="text-xs text-gray-500 mt-1">{t('products.itemsNeedReordering')}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('out')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.outOfStock')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{outOfStockProducts}</p>
            <p className="text-xs text-gray-500 mt-1">{t('products.requiresImmediateAction')}</p>
          </div>
        </div>
      </div>
      )}

      {/* Products Table Card – using shadcn Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t("products.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all shrink-0 border ${
              hasActiveFilters
                ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-900/20"
                : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-600"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t('products.filter')}
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-white inline-block" />
            )}
          </button>
          <button
            onClick={() => {
              resetForm();
              setError(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-green-900/20 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t("products.addProduct")}
          </button>
          <button
            onClick={() => { setBulkRows([createEmptyBulkRow()]); setShowBulkModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-blue-900/20 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 4v6m4-6v6" />
            </svg>
            Bulk Stocks Update
          </button>
          <Tooltip label={t('products.quarantineExpired')}>
            <button
              onClick={handleQuarantineExpired}
              disabled={quarantining}
              className="p-2.5 rounded-xl border border-slate-200 bg-white transition-all text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-40"
            >
              {quarantining ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
            </button>
          </Tooltip>
          <ShadSelect value={stockFilter} onValueChange={(val) => setStockFilter(val as any)}>
            <SelectTrigger className="max-w-[150px] bg-white border-slate-200 rounded-xl focus:outline-none focus:ring-0">
              <SelectValue placeholder={t('products.filterByStock')} />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 rounded-xl overflow-hidden mt-1 font-medium">
              <SelectItem value="all" className="px-4 py-2.5 text-slate-700 focus:bg-slate-50 cursor-pointer">{t('products.allProducts')}</SelectItem>
              <SelectItem value="in" className="px-4 py-2.5 text-emerald-700 focus:bg-emerald-50 cursor-pointer">{t('products.inStock')}</SelectItem>
              <SelectItem value="low" className="px-4 py-2.5 text-amber-700 focus:bg-amber-50 cursor-pointer">{t('products.lowStock')}</SelectItem>
              <SelectItem value="out" className="px-4 py-2.5 text-red-700 focus:bg-red-50 cursor-pointer">{t('products.outOfStock')}</SelectItem>
            </SelectContent>
          </ShadSelect>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.dateFrom')}</label>
                <div className="relative">
                  <button
                    ref={filterFromBtnRef}
                    type="button"
                    onClick={() => setFilterFromShowPicker(!filterFromShowPicker)}
                    className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  >
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span>{filterFromDate ? format(filterFromDate, "dd MMM yyyy") : "Pick a date"}</span>
                  </button>
                  {filterFromShowPicker && (
                    <div id="filter-from-cal-popup" className="fixed z-[70]" style={{ top: filterFromPickPos.top, right: filterFromPickPos.right }}>
                      <SimpleDatePicker date={filterFromDate} onSelect={(d) => { setFilterFromDate(d); setFilterFromShowPicker(false); }} />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.dateTo')}</label>
                <div className="relative">
                  <button
                    ref={filterToBtnRef}
                    type="button"
                    onClick={() => setFilterToShowPicker(!filterToShowPicker)}
                    className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  >
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span>{filterToDate ? format(filterToDate, "dd MMM yyyy") : "Pick a date"}</span>
                  </button>
                  {filterToShowPicker && (
                    <div id="filter-to-cal-popup" className="fixed z-[70]" style={{ top: filterToPickPos.top, right: filterToPickPos.right }}>
                      <SimpleDatePicker date={filterToDate} onSelect={(d) => { setFilterToDate(d); setFilterToShowPicker(false); }} />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.composition')}</label>
                <input type="text" value={filters.composition} onChange={(e) => setFilters(prev => ({ ...prev, composition: e.target.value }))} placeholder={t('products.compositionExample')}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Batch</label>
                <input type="text" value={filters.batch} onChange={(e) => setFilters(prev => ({ ...prev, batch: e.target.value }))} placeholder="e.g. BATCH-001"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.schedule')}</label>
                <ShadSelect value={filters.schedule} onValueChange={(v) => setFilters(prev => ({ ...prev, schedule: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-white border-slate-200 rounded-xl focus:outline-none focus:ring-0">
                    <SelectValue placeholder={t('products.all')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-xl">
                    <SelectItem value="all">{t('products.all')}</SelectItem>
                    {SCHEDULE_TYPES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </ShadSelect>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.gstPercent')}</label>
                <ShadSelect value={filters.gst} onValueChange={(v) => setFilters(prev => ({ ...prev, gst: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-white border-slate-200 rounded-xl focus:outline-none focus:ring-0">
                    <SelectValue placeholder={t('products.all')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-xl">
                    <SelectItem value="all">All</SelectItem>
                    {GST_OPTIONS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </ShadSelect>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.mrpRange')}</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={filters.mrpMin} onChange={(e) => setFilters(prev => ({ ...prev, mrpMin: e.target.value }))} placeholder={t('products.min')} className="w-full px-2 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
                  <span className="text-slate-400 text-xs">-</span>
                  <input type="number" value={filters.mrpMax} onChange={(e) => setFilters(prev => ({ ...prev, mrpMax: e.target.value }))} placeholder={t('products.max')} className="w-full px-2 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => { setFilters({ dateFrom: "", dateTo: "", composition: "", schedule: "", gst: "", mrpMin: "", mrpMax: "", batch: "" }); setFilterFromDate(undefined); setFilterToDate(undefined); setAllBatchesMap({}); }}
                className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors px-3 py-1.5">
                {t('products.clearAllFilters')}
              </button>
            </div>
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 border-b border-blue-100">
            <span className="text-sm font-medium text-blue-700">{selectedRows.size} {t('products.selected')}</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setDeleteConfirm({ count: selectedRows.size })}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                {t('products.deleteTitle')}
              </button>
              <button onClick={() => setSelectedRows(new Set())} className="p-1.5 text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Table – shadcn Table with always-visible action buttons */}
        <div className="overflow-x-auto">
          <Table className="min-w-[650px] lg:min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200">
                {/* Checkbox column - left */}
                <TableHead className="w-10 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                </TableHead>
                {[
                  { field: "name", label: t('products.tableProduct'), sortable: true, align: "left" },
                  { field: "composition", label: t('products.tableComposition'), sortable: true, align: "left" },
                  { field: "schedule_type", label: t('products.tableSchedule'), sortable: false, align: "left" },
                  { field: "gst_percent", label: t('products.tableGst'), sortable: false, align: "left" },
                  { field: "price", label: t('products.tableMrp'), sortable: true, align: "right" },
                  { field: "stock", label: t('products.tableStock'), sortable: true, align: "right" },
                  { field: "batches", label: "Batches", sortable: false, align: "left" },
                  { field: "status", label: t('products.tableStatus'), sortable: false, align: "center" },
                ].map(({ field, label, sortable, align }) => (
                  <TableHead
                    key={field}
                    onClick={sortable ? () => handleSort(field) : undefined}
                    className={`text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${sortable ? "cursor-pointer hover:text-slate-700 select-none" : ""
                      } ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
                  >
                    <div className={`flex items-center ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
                      {label}
                      {sortable && <SortIcon field={field} />}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('products.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    {/* empty state content unchanged */}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((p) => {
                  const batchInfoItem = batchInfo[p.product_uuid];
                  const isNearExpiry = batchInfoItem?.nearestExpiryDays !== null && batchInfoItem?.nearestExpiryDays <= 10 && batchInfoItem?.nearestExpiryDays > 0;
                  const isOutOfStock = p.stock === 0;
                  const isLowStock = p.stock > 0 && p.stock <= 10;
                  const isSelected = selectedRows.has(p.product_uuid);
                  return (
                    <TableRow key={p.product_uuid} className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isSelected ? "bg-blue-50/60" : ""}`}>
                      {/* Checkbox */}
                      <TableCell className="w-10 text-left">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(p.product_uuid)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                      </TableCell>
                      {/* Product */}
                      <TableCell className="text-left">
                        <div className="font-semibold text-sm text-slate-800 truncate">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {p.manufacturer && <span className="text-xs text-slate-400 truncate max-w-[120px]">{p.manufacturer}</span>}
                          {p.medicine_type && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{p.medicine_type}</span>}
                          {p.rack_location && <span className="text-[10px] text-blue-500 font-mono font-medium">{p.rack_location}</span>}
                          {isNearExpiry && (
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {t('products.expiresIn', { days: batchInfoItem.nearestExpiryDays })}
                            </span>
                          )}
                          {batchInfoItem?.hasExpiredStock && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              {batchInfoItem.expiredCount} {t('products.expired')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {/* Composition */}
                      <TableCell className="text-left max-w-[160px]">
                        <span className="text-xs text-slate-500 italic line-clamp-2">{p.composition || "—"}</span>
                      </TableCell>
                      {/* Schedule */}
                      <TableCell className="text-left">
                        {p.schedule_type && p.schedule_type !== "NONE" ? (
                          <Badge variant="schedule">Sch {p.schedule_type}</Badge>
                        ) : (
                          <Badge variant="otc">OTC</Badge>
                        )}
                      </TableCell>
                      {/* GST */}
                      <TableCell className="text-left">
                        <span className="text-xs font-mono text-slate-500">{p.gst_percent || 0}%</span>
                      </TableCell>
                      {/* MRP */}
                      <TableCell className="text-right">
                        <span className="font-semibold text-sm text-slate-800">₹{p.price?.toLocaleString()}</span>
                      </TableCell>
                      {/* Stock */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-semibold text-sm ${isOutOfStock ? "text-red-500" : isLowStock ? "text-amber-600" : "text-slate-700"}`}>
                            {p.stock ?? 0}
                          </span>
                          <span className="text-xs text-slate-400">{p.unit}s</span>
                        </div>
                      </TableCell>
                      {/* Batches */}
                      <TableCell className="text-left">
                        {batchInfoItem && batchInfoItem.hasBatches ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-xs font-medium text-slate-700">{batchInfoItem.batchCount} batch{batchInfoItem.batchCount !== 1 ? "es" : ""}</span>
                              <button
                                onClick={async (e) => { e.stopPropagation(); const data = await getProductBatches(p.product_uuid); setBatchModalProduct({ product_uuid: p.product_uuid, batches: data }); }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                title="View batches"
                              >
                                <HugeiconsIcon icon={InformationCircleIcon} size={17} />
                              </button>
                            </div>
                            {batchInfoItem.nearestExpiryDays !== null && batchInfoItem.nearestExpiryDays <= 10 && (
                              <span className="text-[10px] text-red-500 font-medium">
                                Exp in {batchInfoItem.nearestExpiryDays}d
                              </span>
                            )}
                            {batchInfoItem.hasExpiredStock && (
                              <span className="text-[10px] text-red-500 font-medium">{batchInfoItem.expiredCount} expired</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">–</span>
                        )}
                      </TableCell>
                      {/* Status */}
                      <TableCell className="text-center">
                        {isOutOfStock ? (
                          <Badge variant="danger">{t('products.outOfStockLabel')}</Badge>
                        ) : isLowStock ? (
                          <Badge variant="warning">{t('products.lowStockLabel')}</Badge>
                        ) : (
                          <Badge variant="success">{t('products.inStockLabel')}</Badge>
                        )}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip label={t('products.editTitle')}>
                            <button
                              onClick={() => {
                                handleEdit(p);
                                loadBatchInfo(p.product_uuid);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                              {t('products.editTitle')}
                            </button>
                          </Tooltip>

                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        {filteredProducts.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">{t('products.showingProducts', { start: (pageP - 1) * pageSize + 1, end: Math.min(pageP * pageSize, filteredProducts.length), total: filteredProducts.length })}</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPageP(p => Math.max(1, p - 1))}
                  disabled={pageP === 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('products.prev')}
                </button>
                {(() => {
                  const pages: (number | string)[] = [];
                  const range = 2;
                  for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= pageP - range && i <= pageP + range)) {
                      pages.push(i);
                    } else if (pages[pages.length - 1] !== '...') {
                      pages.push('...');
                    }
                  }
                  return pages.map((p, idx) =>
                    p === '...' ? (
                      <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPageP(p as number)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                          p === pageP
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  );
                })()}
                <button
                  onClick={() => setPageP(p => Math.min(totalPages, p + 1))}
                  disabled={pageP === totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('products.next')}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full" />{t('products.inStockLabel')}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-400 rounded-full" />{t('products.lowStockLabel')}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-400 rounded-full" />{t('products.outOfStockLabel')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Edit / Quick Add Form Modal */}
      {showForm && createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setMissClickToast(true); setTimeout(() => setMissClickToast(false), 2000); } }}>
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/20 w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{editing ? t('products.editProduct') : t('products.quickAddProduct')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{editing ? t('products.updateMedicineInfo') : t('products.addProductManually')}</p>
                </div>
              </div>
              <button onClick={resetForm} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-slate-400">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <Input label={t('products.medicineName')} required value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder={t('products.nameExample')} />
                </div>
                <div className="col-span-2">
                  <Dropdown label="Category" options={CATEGORY_OPTIONS.map(c => ({ value: c.uuid, label: c.name }))} value={form.category_uuid} onChange={(uuid: string) => {
                    setForm({ ...form, category_uuid: uuid });
                    const dflt = CATEGORY_DEFAULTS[uuid];
                    if (dflt) {
                      setForm((prev) => ({
                        ...prev,
                        category_uuid: uuid,
                        schedule_type: prev.schedule_type || dflt.schedule,
                        prescription_required: prev.prescription_required ?? dflt.prescription,
                      }));
                    }
                  }} />
                </div>
                <div className="col-span-2">
                  <Input label={t('products.composition')} value={form.composition} onChange={(e: any) => setForm({ ...form, composition: e.target.value })} placeholder={t('products.compositionExample')} />
                </div>
                <div className="col-span-2">
                  <Input label="Description" value={form.description || ""} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
                </div>
                <Input label={t('products.manufacturer')} value={form.manufacturer} onChange={(e: any) => setForm({ ...form, manufacturer: e.target.value })} placeholder={t('products.manufacturerExample')} />
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.gstRate')}</label>
                  <Select value={form.gst_percent} onChange={(v: string) => setForm({ ...form, gst_percent: v })} options={GST_OPTIONS} placeholder={t('products.selectGst')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.schedule')}</label>
                  <Select value={form.schedule_type} onChange={(v: string) => setForm({ ...form, schedule_type: v })} options={SCHEDULE_TYPES} />
                </div>
                <Input label={t('products.hsnCode')} value={form.hsn_code} onChange={(e: any) => setForm({ ...form, hsn_code: e.target.value })} placeholder={t('products.hsnExample')} />
                <Input label={t('products.barcode')} value={form.barcode} onChange={(e: any) => setForm({ ...form, barcode: e.target.value })} placeholder={t('products.barcodeExample')} />
                <Input label={t('products.sku')} value={form.sku} onChange={(e: any) => setForm({ ...form, sku: e.target.value })} placeholder={t('products.skuOptional')} />
                <Input label={t('products.rackLocation')} value={form.rack_location} onChange={(e: any) => setForm({ ...form, rack_location: e.target.value })} placeholder={t('products.rackExample')} />
                <div className="flex items-end pb-1">
                  <Toggle checked={form.prescription_required} onChange={(v: boolean) => setForm({ ...form, prescription_required: v })} label={t('products.prescriptionRequired')} />
                </div>

                {/* ─── Package Section (Tablets / Capsules / Bottle Medicine only) ─── */}
                {!isSimpleType && (
                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Package</div>
                  <div className="mb-4">
                    <Dropdown label="Product Type" options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} />
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <Input label="Box =" type="number" value={form.boxes} onChange={(e: any) => setForm({ ...form, boxes: e.target.value })} placeholder="0" />
                    <Input label={isBottleMedicine ? "1 box = bottles" : "1 box = strips"} type="number" value={form.strips_per_box} onChange={(e: any) => setForm({ ...form, strips_per_box: e.target.value })} placeholder="0" />
                    <Input label={isBottleMedicine ? "1 bottle = tablets" : "1 strip = tablets"} type="number" value={form.tablets_per_strip} onChange={(e: any) => setForm({ ...form, tablets_per_strip: e.target.value })} placeholder="0" />
                    <Input label="Extra tablets" type="number" value={form.extra_tablets} onChange={(e: any) => setForm({ ...form, extra_tablets: e.target.value })} placeholder="0" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="px-4 py-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Total Strips</span>
                      <span className="text-lg font-bold text-blue-600">
                        {(Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0)}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Total Tablets</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {(Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(form.extra_tablets) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
                )}

                {/* ─── Simple type fields (Liquids / Creams / Devices) ─── */}
                {isSimpleType && (
                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="mb-4">
                    <Dropdown label="Product Type" options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Input label="Price per product" prefix="₹" type="number" value={form.price_per_tablet} onChange={(e: any) => setForm({ ...form, price_per_tablet: e.target.value })} placeholder="0" />
                    <Input label="Total stock" type="number" value={form.total_tablets} onChange={(e: any) => { setForm({ ...form, total_tablets: e.target.value }); }} placeholder="0" />
                  </div>
                </div>
                )}

                {/* ─── Pricing Section (Tablets / Capsules / Bottle Medicine only) ─── */}
                {!isSimpleType && (
                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pricing</div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <Input label="Price per box" prefix="₹" type="number" value={form.price_per_box} onChange={(e: any) => setForm({ ...form, price_per_box: e.target.value })} placeholder="0" />
                    <Input label={isBottleMedicine ? "Price per bottle" : "Price per strip"} prefix="₹" type="number" value={form.price_per_strip} onChange={(e: any) => setForm({ ...form, price_per_strip: e.target.value })} placeholder="0" />
                    <Input label="Price per tablet" prefix="₹" type="number" value={form.price_per_tablet} onChange={(e: any) => setForm({ ...form, price_per_tablet: e.target.value })} placeholder="0" />
                  </div>
                </div>
                )}

                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Batches</div>
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <Input label="Batch No" value={form.batch_number} onChange={(e: any) => setForm({ ...form, batch_number: e.target.value })} placeholder="e.g. B001" />
                        <Input label={isSimpleType ? "Total products" : "Total Tablets"} type="number" value={form.total_tablets} className={!isSimpleType && ((Number(form.total_tablets) || 0) + batchRows.reduce((s, r) => s + (Number(r.total_tablets) || 0), 0)) > ((Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(form.extra_tablets) || 0)) ? "border-red-400 focus:ring-red-500/20 focus:border-red-400" : ""} onChange={(e: any) => { setForm({ ...form, total_tablets: e.target.value, strips: String(Math.round((Number(e.target.value) || 0) / ((Number(form.tablets_per_strip) || 0) || 1))) }); }} placeholder="0" />
                        <Input label="PTR" type="number" step="0.01" value={form.ptr} onChange={(e: any) => setForm({ ...form, ptr: e.target.value })} placeholder="0.00" />
                        
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Mfg Date</label>
                          <div className="relative">
                            <button
                              ref={mfgBtnRef}
                              type="button"
                              onClick={() => setMfgShowPicker(!mfgShowPicker)}
                              className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                            >
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                              <span>{form.manufacture_date ? format(new Date(form.manufacture_date + "T00:00:00"), "dd MMM yyyy") : "Pick a date"}</span>
                            </button>
                            {mfgShowPicker && (
                              <div id="mfg-cal-popup" className="fixed z-[70]" style={{ top: mfgPickPos.top, right: mfgPickPos.right }}>
                                <SimpleDatePicker date={form.manufacture_date ? new Date(form.manufacture_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, manufacture_date: format(d, "yyyy-MM-dd") }); setMfgShowPicker(false); }} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Expiry Date</label>
                          <div className="relative">
                            <button
                              ref={expiryBtnRef}
                              type="button"
                              onClick={() => setExpiryShowPicker(!expiryShowPicker)}
                              className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                            >
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                              <span>{form.expiry_date ? format(new Date(form.expiry_date + "T00:00:00"), "dd MMM yyyy") : "Pick a date"}</span>
                            </button>
                            {expiryShowPicker && (
                              <div id="expiry-cal-popup" className="fixed z-[70]" style={{ top: expiryPickPos.top, right: expiryPickPos.right }}>
                                <SimpleDatePicker date={form.expiry_date ? new Date(form.expiry_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, expiry_date: format(d, "yyyy-MM-dd") }); setExpiryShowPicker(false); }} disableFuture={false} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {batchRows.map((row, idx) => (
                      <div key={row.id} className="border border-slate-200 rounded-xl p-4 bg-white relative">
                        <button
                          type="button"
                          onClick={() => removeBatchRow(row.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-50 border border-red-200 rounded-full flex items-center justify-center text-red-500 hover:bg-red-100 text-sm transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <Input label="Batch No" value={row.batch_number} onChange={(e: any) => updateBatchRow(row.id, "batch_number", e.target.value)} placeholder="e.g. B002" />
                          <Input label={isSimpleType ? "Total products" : "Total Tablets"} type="number" value={row.total_tablets} className={!isSimpleType && ((Number(form.total_tablets) || 0) + batchRows.slice(0, idx).reduce((s, r) => s + (Number(r.total_tablets) || 0), 0) + (Number(row.total_tablets) || 0)) > ((Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(form.extra_tablets) || 0)) ? "border-red-400 focus:ring-red-500/20 focus:border-red-400" : ""} onChange={(e: any) => updateBatchRow(row.id, "total_tablets", e.target.value)} placeholder="0" />
                          <Input label="PTR" type="number" step="0.01" value={row.ptr} onChange={(e: any) => updateBatchRow(row.id, "ptr", e.target.value)} placeholder="0.00" />
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Mfg Date</label>
                            <input type="date" value={row.manufacture_date} onChange={(e: any) => updateBatchRow(row.id, "manufacture_date", e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Expiry Date</label>
                            <input type="date" value={row.expiry_date} onChange={(e: any) => updateBatchRow(row.id, "expiry_date", e.target.value)} className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addBatchRow}
                    className="mt-3 w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    Add Batch
                  </button>
                </div>

                {/* Image */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Image</label>
                  {form.image ? (
                    <div className="relative">
                      <img src={form.image} alt="Preview" className="w-full h-28 object-contain rounded-xl border border-slate-200 bg-slate-50" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image: "" })}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow hover:bg-red-50 hover:text-red-600 text-slate-400 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById("product-image-input")?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f && f.type.startsWith("image/")) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setForm({ ...form, image: ev.target?.result as string });
                          reader.readAsDataURL(f);
                        }
                      }}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
                    >
                      <svg className="w-10 h-10 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-slate-500 font-medium">Click or drag image here</p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF, WEBP</p>
                      <input
                        id="product-image-input"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && f.type.startsWith("image/")) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setForm({ ...form, image: ev.target?.result as string });
                            reader.readAsDataURL(f);
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

                {/* Purchase Details — editable on create, read-only on edit */}
                {editing ? (
                  <>
                    <hr className="border-slate-200 my-4" />
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Purchase Details</div>
                      {!showNewPurchase && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewSupplierSearch("");
                            setNewSupplierDropdownOpen(false);
                            setShowNewPurchase(true);
                          }}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 border border-emerald-300 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition-all"
                        >
                          + Add New Details
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between"><span className="text-slate-500">Supplier</span><span>{supplierSearch || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Invoice No</span><span>{form.invoice_number || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Invoice Date</span><span>{form.invoice_date ? format(new Date(form.invoice_date + "T00:00:00"), "dd MMM yyyy") : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>₹{Number(form.purchase_discount || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span className="font-medium">Subtotal</span><span className="font-bold text-emerald-600">₹{(() => { const q = ((Number(form.strips) || 0) + batchRows.reduce((s, r) => s + (Number(r.strips) || 0), 0)) * (Number(form.tablets_per_strip) || 0); const c = Number(form.purchase_price) || 0; const d = Number(form.purchase_discount) || 0; return Math.max(0, q * c - d).toFixed(2); })()}</span></div>
                    </div>
                    {showNewPurchase && (
                      <>
                        <hr className="border-slate-200 my-4" />
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">New Purchase Details</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          {/* Supplier Combobox */}
                          <div className="relative">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Supplier</label>
                            <input
                              type="text"
                              value={newSupplierSearch}
                              onChange={(e) => { setNewSupplierSearch(e.target.value); setNewSupplierDropdownOpen(true); if (!e.target.value) setForm({ ...form, supplier_uuid: "" }); }}
                              onFocus={() => setNewSupplierDropdownOpen(true)}
                              placeholder="Search or type supplier..."
                              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                            />
                            {newSupplierDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => { setNewSupplierDropdownOpen(false); }} />
                                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ position: 'absolute' }}>
                                  <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                    {!newSupplierSearch.trim() ? (
                                      recentSuppliers.length > 0 ? (
                                        <>
                                          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Suppliers</div>
                                          {recentSuppliers.map((s) => (
                                            <button
                                              key={s.supplier_uuid}
                                              type="button"
                                              onClick={() => {
                                                setForm({ ...form, supplier_uuid: s.supplier_uuid });
                                                setNewSupplierSearch(s.name);
                                                setNewSupplierDropdownOpen(false);
                                              }}
                                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between text-slate-700"
                                            >
                                              <span>{s.name}</span>
                                              {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                                            </button>
                                          ))}
                                          <div className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100 text-center">Type to search all suppliers</div>
                                        </>
                                      ) : (
                                        <div className="px-4 py-6 text-center text-sm text-slate-400">Type to search suppliers</div>
                                      )
                                    ) : (
                                      <>
                                        {suppliers.filter(s => s.name.toLowerCase().includes(newSupplierSearch.toLowerCase())).length === 0 ? (
                                          <div className="px-4 py-6 text-center text-sm text-slate-400">No suppliers found</div>
                                        ) : (
                                          suppliers.filter(s => s.name.toLowerCase().includes(newSupplierSearch.toLowerCase())).map((s) => (
                                            <button
                                              key={s.supplier_uuid}
                                              type="button"
                                              onClick={() => {
                                                setForm({ ...form, supplier_uuid: s.supplier_uuid });
                                                setNewSupplierSearch(s.name);
                                                setNewSupplierDropdownOpen(false);
                                                try {
                                                  const stored = localStorage.getItem("recent_suppliers");
                                                  let uuids: string[] = stored ? JSON.parse(stored) : [];
                                                  uuids = [s.supplier_uuid, ...uuids.filter((id) => id !== s.supplier_uuid)].slice(0, 10);
                                                  localStorage.setItem("recent_suppliers", JSON.stringify(uuids));
                                                  setRecentSuppliers((prev) => {
                                                    const next = [s, ...prev.filter((r) => r.supplier_uuid !== s.supplier_uuid)].slice(0, 10);
                                                    return next;
                                                  });
                                                } catch (e) {}
                                              }}
                                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                                                form.supplier_uuid === s.supplier_uuid ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700"
                                              }`}
                                            >
                                              <span>{s.name}</span>
                                              {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                                            </button>
                                          ))
                                        )}
                                        {!suppliers.some(s => s.name.toLowerCase() === newSupplierSearch.trim().toLowerCase()) && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                const created = await createSupplier({ name: newSupplierSearch.trim() });
                                                setForm({ ...form, supplier_uuid: created.supplier_uuid || created.uuid });
                                                setNewSupplierSearch(newSupplierSearch.trim());
                                                setNewSupplierDropdownOpen(false);
                                                setSuppliers(prev => [...prev, created]);
                                              } catch (e) { console.error(e); }
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 font-medium border-t border-slate-100 flex items-center gap-2"
                                          >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                            Add "{newSupplierSearch.trim()}" as new supplier
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          <Input label="Invoice Number" value={newInvoiceNumber} onChange={(e: any) => setNewInvoiceNumber(e.target.value)} placeholder="e.g. INV-001" />
                          {/* Invoice Date */}
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Invoice Date</label>
                            <div className="relative">
                              <button
                                ref={newInvoiceBtnRef}
                                type="button"
                                onClick={() => {
                                  if (newInvoiceBtnRef.current) {
                                    const r = newInvoiceBtnRef.current.getBoundingClientRect();
                                    setNewInvoicePickPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                                  }
                                  setNewInvoiceShowPicker(!newInvoiceShowPicker);
                                }}
                                className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                              >
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span>{newInvoiceDate ? format(new Date(newInvoiceDate + "T00:00:00"), "dd MMM yyyy") : "Pick a date"}</span>
                              </button>
                              {newInvoiceShowPicker && (
                                <div id="new-inv-cal-popup" className="fixed z-[70]" style={{ top: newInvoicePickPos.top, right: newInvoicePickPos.right }}>
                                  <SimpleDatePicker date={newInvoiceDate ? new Date(newInvoiceDate + "T00:00:00") : undefined} onSelect={(d) => { setNewInvoiceDate(format(d, "yyyy-MM-dd")); setNewInvoiceShowPicker(false); }} />
                                </div>
                              )}
                            </div>
                          </div>
                          <Input label="Supplier Discount (₹)" type="number" value={newPurchaseDiscount} onChange={(e: any) => { setNewPurchaseDiscount(e.target.value); setNewManualSubtotal(null); }} placeholder="0" />
                        </div>
                        {/* Subtotal */}
                        {(() => {
                          const qty = ((Number(form.strips) || 0) + batchRows.reduce((sum, r) => sum + (Number(r.strips) || 0), 0)) * (Number(form.tablets_per_strip) || 0);
                          const cost = Number(form.purchase_price) || 0;
                          const disc = Number(newPurchaseDiscount) || 0;
                          const autoSubtotal = Math.max(0, qty * cost - disc);
                          const displayValue = newManualSubtotal !== null ? newManualSubtotal : autoSubtotal.toFixed(2);
                          return (
                            <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-200 mt-4">
                              <span className="text-sm font-medium text-slate-600">Subtotal</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={displayValue}
                                  onChange={(e) => setNewManualSubtotal(e.target.value)}
                                  className="w-32 text-right bg-transparent border-b border-slate-300 text-2xl font-bold text-emerald-600 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewPurchase(false);
                            setNewSupplierSearch("");
                            setNewInvoiceNumber("");
                            setNewInvoiceDate("");
                            setNewPurchaseDiscount("");
                            setNewManualSubtotal(null);
                          }}
                          className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          Cancel new details
                        </button>
                      </>
                    )}
                  </>
                ) : (
                <>
                <hr className="border-slate-200 my-4" />
                  <div className="border border-slate-200 rounded-xl p-5 bg-white">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Purchase Details (Optional)</div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {/* Supplier Combobox */}
                    <div className="relative">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Supplier</label>
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={(e) => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setForm({ ...form, supplier_uuid: "" }); }}
                        onFocus={() => setSupplierDropdownOpen(true)}
                        placeholder="Search or type supplier..."
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                      />
                      {supplierDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => { setSupplierDropdownOpen(false); }} />
                          <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ position: 'absolute' }}>
                            <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                              {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && !supplierSearch.trim() ? (
                                <div className="px-4 py-6 text-center text-sm text-slate-400">Type to search suppliers</div>
                              ) : (
                                <>
                                  {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map((s) => (
                                    <button
                                      key={s.supplier_uuid}
                                      type="button"
                                      onClick={() => {
                                        setForm({ ...form, supplier_uuid: s.supplier_uuid });
                                        setSupplierSearch(s.name);
                                        setSupplierDropdownOpen(false);
                                        try {
                                          const stored = localStorage.getItem("recent_suppliers");
                                          let uuids: string[] = stored ? JSON.parse(stored) : [];
                                          uuids = [s.supplier_uuid, ...uuids.filter((id) => id !== s.supplier_uuid)].slice(0, 10);
                                          localStorage.setItem("recent_suppliers", JSON.stringify(uuids));
                                          setRecentSuppliers((prev) => {
                                            const next = [s, ...prev.filter((r) => r.supplier_uuid !== s.supplier_uuid)].slice(0, 10);
                                            return next;
                                          });
                                        } catch (e) {}
                                      }}
                                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                                        form.supplier_uuid === s.supplier_uuid ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700"
                                      }`}
                                    >
                                      <span>{s.name}</span>
                                      {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                                    </button>
                                  ))}
                                  {supplierSearch.trim() && !suppliers.some(s => s.name.toLowerCase() === supplierSearch.trim().toLowerCase()) && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const created = await createSupplier({ name: supplierSearch.trim() });
                                          setForm({ ...form, supplier_uuid: created.supplier_uuid || created.uuid });
                                          setSupplierSearch(supplierSearch.trim());
                                          setSupplierDropdownOpen(false);
                                          setSuppliers(prev => [...prev, created]);
                                        } catch (e) { console.error(e); }
                                      }}
                                      className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 font-medium border-t border-slate-100 flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                      Add "{supplierSearch.trim()}" as new supplier
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <Input label="Invoice Number" value={form.invoice_number} onChange={(e: any) => setForm({ ...form, invoice_number: e.target.value })} placeholder="e.g. INV-001" />
                    {/* Invoice Date */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Invoice Date</label>
                      <div className="relative">
                        <button
                          ref={invoiceBtnRef}
                          type="button"
                          onClick={() => setInvoiceShowPicker(!invoiceShowPicker)}
                          className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                        >
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          <span>{form.invoice_date ? format(new Date(form.invoice_date + "T00:00:00"), "dd MMM yyyy") : "Pick a date"}</span>
                        </button>
                        {invoiceShowPicker && (
                          <div id="inv-cal-popup" className="fixed z-[70]" style={{ top: invoicePickPos.top, right: invoicePickPos.right }}>
                            <SimpleDatePicker date={form.invoice_date ? new Date(form.invoice_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, invoice_date: format(d, "yyyy-MM-dd") }); setInvoiceShowPicker(false); }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <Input label="Supplier Discount (₹)" type="number" value={form.purchase_discount} onChange={(e: any) => { setForm({ ...form, purchase_discount: e.target.value }); setManualSubtotal(null); }} placeholder="0" />
                  </div>

                  {/* Subtotal */}
                  {(() => {
                    const qty = ((Number(form.strips) || 0) + batchRows.reduce((sum, r) => sum + (Number(r.strips) || 0), 0)) * (Number(form.tablets_per_strip) || 0);
                    const cost = Number(form.purchase_price) || 0;
                    const disc = Number(form.purchase_discount) || 0;
                    const autoSubtotal = Math.max(0, qty * cost - disc);
                    const displayValue = manualSubtotal !== null ? manualSubtotal : autoSubtotal.toFixed(2);
                    return (
                      <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-200 mt-4">
                        <span className="text-sm font-medium text-slate-600">Subtotal</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            value={displayValue}
                            onChange={(e) => setManualSubtotal(e.target.value)}
                            className="w-32 text-right bg-transparent border-b border-slate-300 text-2xl font-bold text-emerald-600 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                </>
                )}
              {editing && (
                <div className="border-2 border-dashed border-red-300 rounded-xl p-4 bg-red-50/50 mt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">{t('products.dangerZone')}</p>
                  </div>
                  <p className="text-xs text-red-600 mb-3">{t('products.deleteWarning')}</p>
                  <button
                    onClick={() => {
                      const uuid = editing.product_uuid || editing.uuid;
                      const product = products.find((p) => p.product_uuid === uuid);
                      setDeleteConfirm({ uuid, name: product?.name || t('products.thisProduct') });
                    }}
                    disabled={deleting === (editing.product_uuid || editing.uuid)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    {deleting === (editing.product_uuid || editing.uuid) ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                    {deleting === (editing.product_uuid || editing.uuid) ? t('products.deletingEllipsis') : t('products.deleteProduct')}
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                {loading && <Spinner size="sm" />}
                {loading ? (editing ? t('products.updatingEllipsis') : t('products.creatingEllipsis')) : editing ? t('products.updateProduct') : t('products.createProduct')}
              </button>
            </div>
          </div>

        </div>
      , document.body)}

      {ctxMenu && createPortal(
        <div ref={ctxMenuRef} className="fixed z-[90] w-40 bg-white border border-slate-200 rounded-xl shadow-2xl py-1" style={{ left: ctxMenu.x, top: ctxMenu.y }}>
          <button onClick={() => { const excluded = ["uuid", "name"]; const data: Partial<BulkRow> = {}; for (const k in ctxMenu.row) { if (!excluded.includes(k)) (data as any)[k] = (ctxMenu.row as any)[k]; } setCopyBuffer(data); setCtxMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Copy fields
          </button>
          <button onClick={() => { const newRow = createEmptyBulkRow(); Object.assign(newRow, JSON.parse(JSON.stringify(ctxMenu.row))); newRow.uuid = crypto.randomUUID(); setBulkRows((prev) => { const i = prev.findIndex((r) => r.uuid === ctxMenu.row.uuid); const next = [...prev]; next.splice(i + 1, 0, newRow); return next; }); setCtxMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Duplicate
          </button>
          <button onClick={() => { if (copyBuffer) updateBulkRow(ctxMenu.row.uuid, copyBuffer); setCtxMenu(null); }} disabled={!copyBuffer} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-default">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            Paste {copyBuffer ? "fields" : "(copy first)"}
          </button>
          <hr className="my-1 border-slate-100" />
          <button onClick={() => { removeBulkRow(ctxMenu.row.uuid); setCtxMenu(null); }} disabled={bulkRows.length <= 1} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-default">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            Delete row
          </button>
        </div>
      , document.body)}

      {missClickToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-xl text-sm text-amber-800 bg-amber-50 border border-amber-200 shadow-lg animate-pulse">
          Safety miss-click activated — use ✕ button to close
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 text-left">{t('products.deleteProduct')}</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm text-left">
                {"uuid" in deleteConfirm
                  ? t('products.deleteConfirmSingle', { name: deleteConfirm.name })
                  : t('products.deleteConfirmMultiple', { count: deleteConfirm.count })}
              </p>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white rounded-b-2xl">
              <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
                {t('common.cancel')}
              </Button>
              <Button onClick={() => deleteConfirm && confirmDelete(deleteConfirm)} className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-900/20">
                {t('products.deleteTitle')}
              </Button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Quarantine Confirmation Modal */}
      {showQuarantineConfirm && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800 text-left">{t('products.quarantineExpired')}</h2>
            </div>
            <div className="p-6">
              <p className="text-slate-600 text-sm text-left">{t('products.quarantineWarning')}</p>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white rounded-b-2xl">
              <Button variant="outline" onClick={() => setShowQuarantineConfirm(false)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
                {t('common.cancel')}
              </Button>
              <Button onClick={confirmQuarantine} className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-900/20">
                {t('products.quarantine')}
              </Button>
            </div>
          </div>
        </div>
      , document.body)}

      {selectedStat && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStat(null)}>
          <div className="w-[min(90vw,400px)] h-[min(80vh,500px)] rounded-[24px] overflow-hidden pt-5 px-5 pb-3 flex flex-col" style={{ background: "#1a1d1f" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSelectedStat(null)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#dc2626", color: "#fff" }}>
                {t('common.close')}
              </button>
            </div>

            {selectedStat === 'products' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('products.totalProducts')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{totalProducts.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    {t('products.allProducts')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.products} width={400} height={180} color="#3b82f6" />
                </div>
              </>
            )}

            {selectedStat === 'inventory' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('products.inventoryValue')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">₹{Math.round(totalInventoryValue).toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8b5cf6", color: "#fff" }}>
                    {t('products.stockValue')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.inventory} width={400} height={180} color="#8b5cf6" />
                </div>
              </>
            )}

            {selectedStat === 'low' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('products.lowStockLabel')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{lowStockProducts.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#f59e0b", color: "#fff" }}>
                    {t('products.needsReorder')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.low} width={400} height={180} color="#f59e0b" />
                </div>
              </>
            )}

            {selectedStat === 'out' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('products.outOfStockLabel')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{outOfStockProducts.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#ef4444", color: "#fff" }}>
                    {t('products.immediateAction')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.out} width={400} height={180} color="#ef4444" />
                </div>
              </>
            )}

          </div>
        </div>
      , document.body)}

      {/* Bulk Stocks Update Modal */}
      {showBulkModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setMissClickToast(true); setTimeout(() => setMissClickToast(false), 2000); } }}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[calc(100vw-2rem)] lg:max-w-7xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-6 4v6m4-6v6" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Bulk Stocks Update</h2>
                  <p className="text-xs text-slate-500">{bulkRows.length} product{bulkRows.length !== 1 ? "s" : ""} — scroll horizontally to fill all fields</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {bulkSubmitting && (
                  <span className="text-sm text-blue-600 font-medium">Processing {bulkProgress.current} of {bulkProgress.total}...</span>
                )}
                <button onClick={addBulkRow} disabled={bulkSubmitting} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all disabled:opacity-40">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  + Add Row
                </button>
                <button onClick={() => { setShowBulkModal(false); setBulkRows([]); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>

            {/* Progress bar */}
            {bulkSubmitting && (
              <div className="h-1 bg-slate-100 shrink-0">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
              </div>
            )}

            {/* Spreadsheet table */}
            <div ref={bulkTableRef} className="flex-1 overflow-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full">
              <table className="border-collapse text-xs w-max">
                <thead>
                  <tr className="bg-slate-50 sticky top-0 z-10">
                    <th className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-200 px-2 py-2.5 text-left font-semibold text-slate-600 w-10 text-center">#</th>
                    {[
                      { label: "Name*", w: 160 }, { label: "Composition", w: 160 }, { label: "Description", w: 160 },
                      { label: "Manufacturer", w: 140 }, { label: "MRP*", w: 90 }, { label: "PTR", w: 90 },
                      { label: "Disc%", w: 70 }, { label: "GST", w: 100 }, { label: "Schedule", w: 110 },
                      { label: "HSN", w: 100 }, { label: "Barcode", w: 120 }, { label: "SKU", w: 100 },
                      { label: "Rack", w: 90 }, { label: "Category", w: 110 }, { label: "Rx", w: 50 },
                      { label: "Unit", w: 80 }, { label: "Batch", w: 110 }, { label: "Qty", w: 70 },
                      { label: "Mfg Date", w: 110 }, { label: "Exp Date", w: 110 },
                      { label: "Supplier", w: 150 }, { label: "Inv#", w: 110 }, { label: "Inv Date", w: 110 },
                      { label: "S.Disc ₹", w: 85 }, { label: "Subtotal", w: 100 },
                    ].map((col) => (
                      <th key={col.label} className="border-r border-b border-slate-200 px-2 py-2.5 text-left font-semibold text-slate-600" style={{ minWidth: col.w }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, idx) => {
                    const qty = Number(row.quantity) || 0;
                    const cost = Number(row.purchase_price) || 0;
                    const disc = Number(row.purchase_discount) || 0;
                    const subtotal = Math.max(0, qty * cost - disc);
                    return (
                      <tr key={row.uuid} className="hover:bg-blue-50/40 even:bg-slate-50/50 cursor-default">
                        <td className="sticky left-0 z-10 bg-inherit border-r border-b border-slate-200 px-1 py-1 text-center">
                          <span className="text-slate-400 text-[11px] font-mono">{idx + 1}</span>
                        </td>

                        {/* Name */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.name} onChange={(e) => updateBulkRow(row.uuid, { name: e.target.value })}
                            placeholder="Required" className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800 placeholder:text-slate-300" />
                        </td>

                        {/* Composition */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.composition} onChange={(e) => updateBulkRow(row.uuid, { composition: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Description */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.description} onChange={(e) => updateBulkRow(row.uuid, { description: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Manufacturer */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.manufacturer} onChange={(e) => updateBulkRow(row.uuid, { manufacturer: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* MRP */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="number" value={row.price} onChange={(e) => updateBulkRow(row.uuid, { price: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                        </td>

                        {/* PTR */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="number" value={row.purchase_price} onChange={(e) => updateBulkRow(row.uuid, { purchase_price: e.target.value, manual_subtotal: null })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                        </td>

                        {/* Disc% */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="number" value={row.discount} onChange={(e) => updateBulkRow(row.uuid, { discount: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800 [appearance:textfield]" />
                        </td>

                        {/* GST */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <select value={row.gst_percent} onChange={(e) => updateBulkRow(row.uuid, { gst_percent: e.target.value })}
                            className="w-full px-1 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-700">
                            {GST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>

                        {/* Schedule */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <select value={row.schedule_type} onChange={(e) => updateBulkRow(row.uuid, { schedule_type: e.target.value })}
                            className="w-full px-1 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-700">
                            {SCHEDULE_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </td>

                        {/* HSN */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.hsn_code} onChange={(e) => updateBulkRow(row.uuid, { hsn_code: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Barcode */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.barcode} onChange={(e) => updateBulkRow(row.uuid, { barcode: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* SKU */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.sku} onChange={(e) => updateBulkRow(row.uuid, { sku: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Rack */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.rack_location} onChange={(e) => updateBulkRow(row.uuid, { rack_location: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Category */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <select value={row.category_uuid} onChange={(e) => {
                            const uuid = e.target.value;
                            const dflt = CATEGORY_DEFAULTS[uuid];
                            updateBulkRow(row.uuid, {
                              category_uuid: uuid,
                              schedule_type: dflt ? dflt.schedule : row.schedule_type,
                              prescription_required: dflt ? dflt.prescription : row.prescription_required,
                            });
                          }}
                            className="w-full px-1 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-700">
                            <option value="">Select...</option>
                            {CATEGORY_OPTIONS.map((c) => <option key={c.uuid} value={c.uuid}>{c.name}</option>)}
                          </select>
                        </td>

                        {/* Rx */}
                        <td className="border-r border-b border-slate-200 px-1 py-1 text-center">
                          <input type="checkbox" checked={row.prescription_required} onChange={(e) => updateBulkRow(row.uuid, { prescription_required: e.target.checked })}
                            className="accent-blue-600 w-3.5 h-3.5" />
                        </td>

                        {/* Unit */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.unit} onChange={(e) => updateBulkRow(row.uuid, { unit: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Batch */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.batch_number} onChange={(e) => updateBulkRow(row.uuid, { batch_number: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Qty */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="number" value={row.quantity} onChange={(e) => updateBulkRow(row.uuid, { quantity: e.target.value, manual_subtotal: null })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800 [appearance:textfield]" />
                        </td>

                        {/* Mfg Date */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="date" value={row.manufacture_date} onChange={(e) => updateBulkRow(row.uuid, { manufacture_date: e.target.value })}
                            className="w-full px-1 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-700 text-[11px]" />
                        </td>

                        {/* Exp Date */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="date" value={row.expiry_date} onChange={(e) => updateBulkRow(row.uuid, { expiry_date: e.target.value })}
                            className="w-full px-1 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-700 text-[11px]" />
                        </td>

                        {/* Supplier */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.supplier_name} onChange={(e) => updateBulkRow(row.uuid, { supplier_name: e.target.value })}
                            placeholder="Type supplier name" list="bulk-supplier-suggest"
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800 placeholder:text-slate-300" />
                          <datalist id="bulk-supplier-suggest">
                            {suppliers.map((s) => <option key={s.supplier_uuid} value={s.name} />)}
                          </datalist>
                        </td>

                        {/* Inv# */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input value={row.invoice_number} onChange={(e) => updateBulkRow(row.uuid, { invoice_number: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800" />
                        </td>

                        {/* Inv Date */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="date" value={row.invoice_date} onChange={(e) => updateBulkRow(row.uuid, { invoice_date: e.target.value })}
                            className="w-full px-1 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-700 text-[11px]" />
                        </td>

                        {/* S.Disc ₹ */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="number" value={row.purchase_discount} onChange={(e) => updateBulkRow(row.uuid, { purchase_discount: e.target.value, manual_subtotal: null })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-800 [appearance:textfield]" />
                        </td>

                        {/* Subtotal (editable) */}
                        <td className="border-r border-b border-slate-200 px-1 py-1">
                          <input type="number" step="0.01"
                            value={row.manual_subtotal !== null ? row.manual_subtotal : subtotal.toFixed(2)}
                            onChange={(e) => updateBulkRow(row.uuid, { manual_subtotal: e.target.value })}
                            className="w-full px-1.5 py-1 border border-transparent focus:border-emerald-400 rounded bg-transparent focus:bg-white focus:ring-1 focus:ring-emerald-500/20 outline-none text-slate-700 text-right font-medium [appearance:textfield]" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end shrink-0">
              <button
                onClick={handleBulkSubmit}
                disabled={bulkSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {bulkSubmitting && <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />}
                {bulkSubmitting ? `Processing ${bulkProgress.current} of ${bulkProgress.total}...` : `Submit ${bulkRows.length} Product${bulkRows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Batch Info Modal */}
      {batchModalProduct && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setBatchModalProduct(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Product Batches</h3>
              <button onClick={() => setBatchModalProduct(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 text-xs font-medium text-gray-500">Batch No</th>
                    <th className="text-center pb-2 text-xs font-medium text-gray-500">Qty</th>
                    <th className="text-center pb-2 text-xs font-medium text-gray-500">Sold</th>
                    <th className="text-right pb-2 text-xs font-medium text-gray-500">Mfg</th>
                    <th className="text-right pb-2 text-xs font-medium text-gray-500">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {batchModalProduct.batches.map((b: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 text-gray-800 font-medium">{b.batch_number || "-"}</td>
                      <td className="py-2.5 text-center text-gray-700">{b.quantity || 0}</td>
                      <td className="py-2.5 text-center text-gray-400">{b.sold_quantity || 0}</td>
                      <td className="py-2.5 text-right text-gray-500">{b.manufacture_date ? format(new Date(b.manufacture_date + "T00:00:00"), "dd MMM yyyy") : "-"}</td>
                      <td className="py-2.5 text-right text-gray-500">{b.expiry_date ? format(new Date(b.expiry_date + "T00:00:00"), "dd MMM yyyy") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
