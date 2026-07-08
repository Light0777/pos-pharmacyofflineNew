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
import { apiGet } from "../../renderer/services/api";
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

interface BatchRow {
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

const UNIT_OPTIONS = ["Tablets / Capsules", "Liquids", "Creams / Ointments", "Devices", "Bottled Tablets", "Piece", "Bandage", "General"];

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
  bottles: "",
  total_tablets: "",
  ptr: "",
  supplier_uuid: "",
  invoice_number: "",
  invoice_date: "",
  purchase_discount: "",
  purchase_total: "",
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
        onWheel={(e) => { if (props.type === "number") { e.preventDefault(); (e.target as HTMLElement).blur(); } }}
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

// ─── Image compression utility ────────────────────────────────────────────
const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; }
        if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// ─── Main Products Component ──────────────────────────────────────────────
export default function Products() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingBatchUuid, setEditingBatchUuid] = useState<string | null>(null);
  const [editingPurchaseUuid, setEditingPurchaseUuid] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out" | "expired">("all");
  const [expiredProductUuids, setExpiredProductUuids] = useState<Set<string>>(new Set());
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
  const [batchDatePicker, setBatchDatePicker] = useState<{ id: string; field: 'mfg' | 'exp'; top: number; right: number } | null>(null);
  const [invoiceShowPicker, setInvoiceShowPicker] = useState(false);
  const invoiceBtnRef = useRef<HTMLButtonElement>(null);
  const [invoicePickPos, setInvoicePickPos] = useState({ top: 0, right: 0 });
  const [filterFromShowPicker, setFilterFromShowPicker] = useState(false);
  const [filterToShowPicker, setFilterToShowPicker] = useState(false);
  const [filterFromPickPos, setFilterFromPickPos] = useState({ top: 0, right: 0 });
  const [filterToPickPos, setFilterToPickPos] = useState({ top: 0, right: 0 });
  const filterFromBtnRef = useRef<HTMLButtonElement>(null);
  const filterToBtnRef = useRef<HTMLButtonElement>(null);
  const pickerHeight = 280;
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const formRef = useRef(form);
  formRef.current = form;
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
  const [deleteBatchConfirm, setDeleteBatchConfirm] = useState<string | null>(null);
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
  const [newPurchaseBatchIds, setNewPurchaseBatchIds] = useState<string[]>([]);
  const [newPurchaseBatchOpen, setNewPurchaseBatchOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

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
      if (stockFilter === "expired") return expiredProductUuids.has(p.product_uuid);
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
  useEffect(() => {
    if (!mfgShowPicker || !mfgBtnRef.current) return;
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
    if (!batchDatePicker) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('#batch-date-popup') || target.closest('.batch-date-btn')) return;
      setBatchDatePicker(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [batchDatePicker]);

  useEffect(() => {
    if (!invoiceShowPicker || !invoiceBtnRef.current) return;
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
      setBatchInfo({});
      const json = await apiGet("/product-batches/expired");
      const uuids = new Set<string>((json.data || []).map((b: any) => b.product_uuid));
      setExpiredProductUuids(uuids);
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
      if (expiredBatches.length > 0) {
        setExpiredProductUuids((prev) => {
          const next = new Set(prev);
          next.add(product_uuid);
          return next;
        });
      }
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
    (async () => {
      try {
        const json = await apiGet("/product-batches/expired");
        const uuids = new Set<string>((json.data || []).map((b: any) => b.product_uuid));
        setExpiredProductUuids(uuids);
      } catch (_) {}
    })();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        apiGet("/product-batches/expired").then((json) => {
          const uuids = new Set<string>((json.data || []).map((b: any) => b.product_uuid));
          setExpiredProductUuids(uuids);
        }).catch(() => {});
        setBatchInfo({});
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
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
      purchase_price: p.purchase_price != null ? String(p.purchase_price) : "",
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
      discount: p.discount != null ? String(p.discount) : "",
      boxes: String(p.boxes ?? ""),
      strips_per_box: String(p.strips_per_box ?? ""),
      tablets_per_strip: String(p.tablets_per_strip ?? ""),
      extra_tablets: String(p.extra_tablets ?? ""),
      price_per_box: String(p.price_per_box ?? ""),
      price_per_strip: String(p.price_per_strip ?? ""),
      price_per_tablet: String(p.price_per_tablet ?? ""),
      batch_number: "", strips: "", bottles: "", total_tablets: "", manufacture_date: "", expiry_date: "", ptr: "",
      purchase_discount: "", supplier_uuid: "", invoice_number: "", invoice_date: "", purchase_total: "",
    });
    // Load batch data into form & store active batch UUID
    getProductBatches(p.product_uuid).then((batches) => {
      const all = batches || [];
      const active = all.filter((b: any) => (b.quantity || 0) > 0);
      setEditingBatchUuid(active.length > 0 ? active[0].batch_uuid : null);
      setEditingPurchaseUuid(all[0]?.purchase_uuid || null);
      setOriginalBatchUuids(all.map((b: any) => b.batch_uuid).filter(Boolean));
      const isLiquidType = ["Liquids", "Creams / Ointments", "Devices", "Piece"].includes(p.unit);
      const tsp = Number(p.tablets_per_strip) || 1;
      if (active.length > 0) {
        const b = active[0];
        const stripVal = String(b.strips || (b.quantity ? Math.round(b.quantity / tsp) : 0) || 0);
        const tabletVal = isLiquidType ? stripVal : String((Number(stripVal) || 0) * (Number(p.tablets_per_strip) || 0) + (Number(p.extra_tablets) || 0));
        const updates: any = {
          batch_number: b.batch_number || "",
          strips: stripVal,
          strips_per_box: stripVal,
          bottles: String(Math.floor(Number(tabletVal) / tsp)),
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
        bottles: String(Math.floor((b.quantity || 0) / tsp)),
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
              purchase_total: latest.total ? String(latest.total) : "",
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
    setFormKey(k => k + 1);
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
        resetForm();
        window.dispatchEvent(new CustomEvent('stock-updated'));
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
      window.dispatchEvent(new CustomEvent('stock-updated'));
      setSuccess("Selected products deleted successfully!");
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const addBatchRow = () => {
    setBatchRows((prev) => [...prev, {
      id: `batch-${Date.now()}`,
      batch_number: "",
      bottles: "",
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

  const confirmDeleteBatch = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteBatchConfirm(id);
  };

  const updateBatchRow = (id: string, field: string, value: string) => {
    setBatchRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      const tps = Number(form.tablets_per_strip) || 1;
      if (field === "bottles") {
        updated.total_tablets = String((Number(value) || 0) * tps);
        updated.strips = String(Math.round((Number(updated.total_tablets) || 0) / tps));
      }
      if (field === "strips") {
        updated.total_tablets = String((Number(value) || 0) * tps);
      }
      if (field === "total_tablets") {
        updated.strips = String(Math.round((Number(value) || 0) / tps));
        updated.bottles = String(Math.floor((Number(value) || 0) / tps));
      }
      return updated;
    }));
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
    setNewPurchaseBatchIds([]);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      setError("Product name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const f = formRef.current;
      const isSimple = ["Liquids", "Creams / Ointments", "Devices", "Piece"].includes(f.unit);
      const tsp = Number(f.tablets_per_strip) || 1;
      const payload: any = {
        name: f.name,
        price: Number(f.price_per_tablet) || 0,
        sku: f.sku || null,
        barcode: f.barcode || null,
        gst_percent: Number(f.gst_percent) || 0,
        hsn_code: f.hsn_code || null,
        unit: f.unit || "Tablet",
        image: f.image || null,
        category_uuid: f.category_uuid || null,
        manufacturer: f.manufacturer || null,
        composition: f.composition || null,
        description: f.description || null,
        schedule_type: f.schedule_type || "NONE",
        prescription_required: f.prescription_required ? 1 : 0,
        rack_location: f.rack_location || null,
        purchase_price: Number(f.purchase_price) || 0,
        discount: Number(f.discount) || 0,
      };
      if (isSimple) {
        payload.boxes = 0; payload.strips_per_box = 0; payload.tablets_per_strip = 0; payload.extra_tablets = 0;
        payload.price_per_box = 0; payload.price_per_strip = 0; payload.price_per_tablet = Number(f.price_per_tablet) || 0;
      } else {
        payload.boxes = Number(f.boxes) || 0;
        payload.strips_per_box = Number(f.strips_per_box) || 0;
        payload.tablets_per_strip = Number(f.tablets_per_strip) || 0;
        payload.extra_tablets = Number(f.extra_tablets) || 0;
        payload.price_per_box = Number(f.price_per_box) || 0;
        payload.price_per_strip = Number(f.price_per_strip) || 0;
        payload.price_per_tablet = Number(f.price_per_tablet) || 0;
      }
        const computeBatchQty = (strips: string) => (Number(strips) || 0) * tsp;
        const batchPtr = (ptr: string) => Number(ptr) || 0;
        const createSingleBatch = (puuid: string, bn: string, strips: string, ptr: string, mfg: string | undefined, exp: string | undefined) =>
          createProductBatch({ product_uuid: puuid, batch_number: bn, manufacture_date: mfg, expiry_date: exp || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0], quantity: computeBatchQty(strips), ptr: batchPtr(ptr), purchase_price: batchPtr(ptr), mrp: Number(f.price_per_tablet) || 0 });

        if (editing) {
          const updateResult = await updateProduct(editing.product_uuid, payload);
          if (updateResult && updateResult.success === false) throw new Error(updateResult.error || 'Update failed');
          // Sync product_units — delete all and recreate with current prices
          const existingUnits = await getProductUnits(editing.product_uuid);
          for (const u of existingUnits) await deleteProductUnit(u.unit_uuid);
          const baseUnitName = f.unit === "General" ? "Piece" : (f.unit || "Tablet");
          const spb = Number(f.strips_per_box) || 0;
          const tps = Number(f.tablets_per_strip) || (isSimple ? 1 : 0);
          const ppb = Number(f.price_per_box) || 0;
          const pps = Number(f.price_per_strip) || 0;
          const ppt = Number(f.price_per_tablet) || 0;
          await createProductUnit({ product_uuid: editing.product_uuid, unit_name: baseUnitName, conversion_factor: 1, is_base_unit: true, price: ppt || 0 });
          if (!isSimple && tps > 0) {
            await createProductUnit({ product_uuid: editing.product_uuid, unit_name: (f.unit === "Bandage" || f.unit === "General") ? "Pack" : "Strip", conversion_factor: tps, is_base_unit: false, price: pps || 0 });
          }
          if (!isSimple && Number(f.boxes) > 0 && spb > 0 && tps > 0) {
            await createProductUnit({ product_uuid: editing.product_uuid, unit_name: "Box", conversion_factor: spb * tps, is_base_unit: false, price: ppb || 0 });
          }
          // If new purchase details were added, create a purchase linking selected batches only
          if (showNewPurchase && f.supplier_uuid) {
            const purchaseBatches: Array<{ id: string; batch_number: string; batch_uuid?: string; strips: string; ptr: string; manufacture_date: string | undefined; expiry_date: string | undefined }> = [];
            if (f.batch_number || f.strips) {
              purchaseBatches.push({ id: 'form-batch', batch_number: f.batch_number || "BATCH-" + Date.now(), batch_uuid: editingBatchUuid || undefined, strips: f.strips, ptr: f.ptr, manufacture_date: f.manufacture_date || undefined, expiry_date: f.expiry_date || undefined });
            }
            for (const row of batchRows) {
              if (row.batch_number) {
                purchaseBatches.push({ id: row.id, batch_number: row.batch_number, batch_uuid: row.batch_uuid || undefined, strips: row.strips, ptr: row.ptr, manufacture_date: row.manufacture_date || undefined, expiry_date: row.expiry_date || undefined });
              }
            }
            const selectedBatches = purchaseBatches.filter(b => newPurchaseBatchIds.includes(b.id));
            if (selectedBatches.length > 0 && newPurchaseBatchIds.length > 0) {
              await createPurchase({
                supplier_uuid: f.supplier_uuid,
                invoice_number: newInvoiceNumber || undefined,
                invoice_date: newInvoiceDate || undefined,
                discount: Number(newPurchaseDiscount) || 0,
                total: newManualSubtotal !== null ? Number(newManualSubtotal) : undefined,
                items: selectedBatches.map(b => ({ product_uuid: editing.product_uuid, batch_uuid: b.batch_uuid, batch_number: b.batch_number, manufacture_date: b.manufacture_date, expiry_date: b.expiry_date || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0], quantity: computeBatchQty(b.strips), strips: Number(b.strips) || 0, ptr: batchPtr(b.ptr), cost_price: batchPtr(b.ptr), mrp: Number(f.price_per_tablet) || 0 })),
              });
            }
          }
          // Update/create first batch (skip standalone creation if handled by new purchase above)
          const stripsVal = f.strips || (isSimple ? f.total_tablets : "");
          const hasBatchFields = f.batch_number || stripsVal || f.ptr || f.manufacture_date || f.expiry_date || f.supplier_uuid;
          if (hasBatchFields) {
            if (editingBatchUuid) {
              const batchUpdates: Record<string, any> = {};
              batchUpdates.batch_number = f.batch_number || "";
              if (stripsVal) { batchUpdates.strips = Number(stripsVal); batchUpdates.quantity = computeBatchQty(stripsVal); }
              batchUpdates.ptr = batchPtr(f.ptr);
              batchUpdates.purchase_price = batchPtr(f.ptr);
              batchUpdates.manufacture_date = f.manufacture_date || null;
              batchUpdates.expiry_date = f.expiry_date || null;
              if (f.supplier_uuid) batchUpdates.supplier_uuid = f.supplier_uuid;
              await updateProductBatch(editingBatchUuid, batchUpdates);
            } else if ((f.batch_number || stripsVal) && !(showNewPurchase && f.supplier_uuid)) {
              await createSingleBatch(editing.product_uuid, f.batch_number || "BATCH-" + Date.now(), stripsVal, f.ptr, f.manufacture_date || undefined, f.expiry_date || undefined);
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
                manufacture_date: row.manufacture_date || null,
                expiry_date: row.expiry_date || null,
                mrp: Number(f.price_per_tablet) || 0,
              });
            } else if (!(showNewPurchase && f.supplier_uuid)) {
              await createSingleBatch(editing.product_uuid, row.batch_number, row.strips, row.ptr, row.manufacture_date || undefined, row.expiry_date || undefined);
            }
          }
          // Delete batches removed from UI
          const currentUuids = [editingBatchUuid, ...batchRows.map(r => r.batch_uuid)].filter(Boolean);
          for (const uuid of originalBatchUuids) {
            if (!currentUuids.includes(uuid)) {
              try {
                const delResult = await deleteBatch(uuid) as any;
                if (delResult && !delResult.success) {
                  if (delResult.reason === 'has_references') {
                    // Batch has existing sales — keep in DB for historical record
                  } else {
                    console.warn("Failed to delete batch", uuid, delResult.error);
                  }
                }
              } catch (e: any) {
                console.error("Failed to delete batch", uuid, e);
              }
            }
          }
          // Update purchase record if linked
          if (editingPurchaseUuid && (f.invoice_number || f.invoice_date || f.purchase_discount || f.supplier_uuid)) {
            const purchaseUpdates: Record<string, any> = {};
            if (f.invoice_number) purchaseUpdates.invoice_number = f.invoice_number;
            if (f.invoice_date) purchaseUpdates.invoice_date = f.invoice_date;
            if (f.purchase_discount) purchaseUpdates.discount = Number(f.purchase_discount);
            if (f.supplier_uuid) purchaseUpdates.supplier_uuid = f.supplier_uuid;
            await updatePurchase(editingPurchaseUuid, purchaseUpdates);
          }
        } else {
          const created = await createProduct(payload);
          const baseUnitName = f.unit === "General" ? "Piece" : (f.unit || "Tablet");
          const spb = Number(f.strips_per_box) || 0;
          const tps = Number(f.tablets_per_strip) || (isSimple ? 1 : 0);
          const ppb = Number(f.price_per_box) || 0;
          const pps = Number(f.price_per_strip) || 0;
          const ppt = Number(f.price_per_tablet) || 0;
          await createProductUnit({ product_uuid: created.product_uuid, unit_name: baseUnitName, conversion_factor: 1, is_base_unit: true, price: ppt || 0 });
          if (!isSimple && tps > 0) {
            await createProductUnit({ product_uuid: created.product_uuid, unit_name: (f.unit === "Bandage" || f.unit === "General") ? "Pack" : "Strip", conversion_factor: tps, is_base_unit: false, price: pps || 0 });
          }
          if (!isSimple && Number(f.boxes) > 0 && spb > 0 && tps > 0) {
            await createProductUnit({ product_uuid: created.product_uuid, unit_name: "Box", conversion_factor: spb * tps, is_base_unit: false, price: ppb || 0 });
          }
          // Collect all batch rows (first form batch + additional)
          const allBatches = [
            { bn: f.batch_number, strips: f.strips, ptr: f.ptr, mfg: f.manufacture_date || undefined, exp: f.expiry_date || undefined },
            ...batchRows.filter(r => r.batch_number).map(r => ({ bn: r.batch_number, strips: r.strips, ptr: r.ptr, mfg: r.manufacture_date || undefined, exp: r.expiry_date || undefined })),
          ].filter(b => b.bn);
          // Create purchase if supplier is selected (purchase model creates the batch)
          if (f.supplier_uuid && allBatches.length > 0) {
            await createPurchase({
              supplier_uuid: f.supplier_uuid,
              invoice_number: f.invoice_number || undefined,
              invoice_date: f.invoice_date || undefined,
              discount: Number(f.purchase_discount) || 0,
              total: manualSubtotal !== null ? Number(manualSubtotal) : undefined,
              items: allBatches.map(b => ({ product_uuid: created.product_uuid, batch_number: b.bn, manufacture_date: b.mfg, expiry_date: b.exp || new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0], quantity: computeBatchQty(b.strips), strips: Number(b.strips) || 0, ptr: batchPtr(b.ptr), cost_price: batchPtr(b.ptr), mrp: Number(f.price_per_tablet) || 0 })),
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
  const isBottleMedicine = form.unit === "Bottled Tablets";
  const isBandageType = form.unit === "Bandage";
  const isGeneralType = form.unit === "General";
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
              setFormKey(k => k + 1);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-green-900/20 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t("products.addProduct")}
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
              <SelectItem value="expired" className="px-4 py-2.5 text-red-700 focus:bg-red-50 cursor-pointer">Expired</SelectItem>
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
                    <span>{filterFromDate ? format(filterFromDate, "dd MMM yyyy") : t('products.pickDate')}</span>
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
                    <span>{filterToDate ? format(filterToDate, "dd MMM yyyy") : t('products.pickDate')}</span>
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
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.batch')}</label>
                <input type="text" value={filters.batch} onChange={(e) => setFilters(prev => ({ ...prev, batch: e.target.value }))} placeholder={t('products.batchPlaceholder')}
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
                className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors px-3 py-1.5 rounded-lg shadow-sm">
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
                          <span className="text-xs text-slate-400">{p.unit === "General" ? "Pieces" : `${p.unit}s`}</span>
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
                        ) : batchInfoItem && batchInfoItem.hasExpiredStock ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-xs font-medium text-red-600">{batchInfoItem.expiredCount} expired</span>
                              <button
                                onClick={async (e) => { e.stopPropagation(); const data = await getProductBatches(p.product_uuid); setBatchModalProduct({ product_uuid: p.product_uuid, batches: data }); }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                title="View batches"
                              >
                                <HugeiconsIcon icon={InformationCircleIcon} size={17} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">–</span>
                        )}
                      </TableCell>
                      {/* Status */}
                      <TableCell className="text-center">
                        {expiredProductUuids.has(p.product_uuid) ? (
                          <Badge variant="danger">Expired</Badge>
                        ) : isOutOfStock ? (
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
                  <h2 className="text-base font-bold text-slate-900">{editing ? t('products.editProduct') : form.name.trim() ? form.name : t('products.quickAddProduct')}</h2>
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

            <div key={formKey} className="flex-1 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-slate-400">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <Input label={t('products.medicineName')} required value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder={t('products.nameExample')} />
                </div>
                <div className="col-span-2">
                  <Dropdown label={t('products.category')} options={CATEGORY_OPTIONS.map(c => ({ value: c.uuid, label: c.name }))} value={form.category_uuid} onChange={(uuid: string) => {
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
                  <Input label={t('products.composition')} value={form.composition} onChange={(e: any) => setForm(prev => ({ ...prev, composition: e.target.value }))} placeholder={t('products.compositionExample')} />
                </div>
                <div className="col-span-2">
                  <Input label={t('products.description')} value={form.description || ""} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder={t('products.descriptionOptional')} />
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
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.package')}</div>
                  <div className="mb-4">
                    <Dropdown label={t('products.productType')} options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} />
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <Input label={t('products.boxEquals')} type="number" value={form.boxes} onChange={(e: any) => {
                      const newBoxes = e.target.value;
                      const spb = Number(newBoxes) || 1;
                      const stripsVal = String(spb * (Number(form.strips_per_box) || 0));
                      const tps = Number(form.tablets_per_strip) || 0;
                      const tabletVal = String((Number(stripsVal) || 0) * tps + (Number(form.extra_tablets) || 0));
                      setForm({ ...form, boxes: newBoxes, strips: stripsVal, total_tablets: tabletVal });
                    }} placeholder="0" />
                    <Input label={isBottleMedicine ? t('products.boxBottles') : (isBandageType || isGeneralType) ? "1 box = pack" : t('products.boxStrips')} type="number" value={form.strips_per_box} onChange={(e: any) => {
                      const newSpb = e.target.value;
                      const spb = Number(newSpb) || 0;
                      const stripsVal = String((Number(form.boxes) || 1) * spb);
                      const tps = Number(form.tablets_per_strip) || 0;
                      const tabletVal = String((Number(stripsVal) || 0) * tps + (Number(form.extra_tablets) || 0));
                      setForm({ ...form, strips_per_box: newSpb, strips: stripsVal, total_tablets: tabletVal });
                    }} placeholder="0" />
                    <Input label={isBottleMedicine ? t('products.bottleTablets') : isBandageType ? "1 pack = bandages" : isGeneralType ? "1 pack = pieces" : t('products.stripTablets')} type="number" value={form.tablets_per_strip} onChange={(e: any) => {
                      const newTps = e.target.value;
                      const tps = Number(newTps) || 0;
                      const tabletVal = String((Number(form.strips) || 0) * tps + (Number(form.extra_tablets) || 0));
                      setForm({ ...form, tablets_per_strip: newTps, total_tablets: tabletVal });
                    }} placeholder="0" />
                    <Input label={isBandageType ? "Extra bandages" : isGeneralType ? "Extra pieces" : t('products.extraTablets')} type="number" value={form.extra_tablets} onChange={(e: any) => {
                      const newEt = e.target.value;
                      const tabletVal = String((Number(form.strips) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(newEt) || 0));
                      setForm({ ...form, extra_tablets: newEt, total_tablets: tabletVal });
                    }} placeholder="0" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="px-4 py-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">{(isBandageType || isGeneralType) ? "Total Packs" : t('products.totalStrips')}</span>
                      <span className="text-lg font-bold text-blue-600">
                        {batchRows.reduce((s, r) => s + (Number(r.strips) || 0), 0) + (Number(form.strips) || 0)}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">{isBandageType ? "Total Bandages" : isGeneralType ? "Total Pieces" : t('products.totalTablets')}</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {batchRows.reduce((s, r) => s + (Number(r.total_tablets) || 0), 0) + (Number(form.total_tablets) || 0)}
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
                    <Dropdown label={t('products.productType')} options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Input label={t('products.pricePerProduct')} prefix="₹" type="number" value={form.price_per_tablet} onChange={(e: any) => setForm({ ...form, price_per_tablet: e.target.value })} placeholder="0" />
                    <Input label={t('products.totalStock')} type="number" value={form.total_tablets} onChange={(e: any) => { const v = e.target.value; setForm({ ...form, total_tablets: v, strips: String(Math.round((Number(v) || 0) / ((Number(form.tablets_per_strip) || 0) || 1))) }); }} placeholder="0" />
                  </div>
                </div>
                )}

                {/* ─── Pricing Section (Tablets / Capsules / Bottle Medicine only) ─── */}
                {!isSimpleType && (
                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.pricing')}</div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <Input label={t('products.pricePerBox')} prefix="₹" type="number" value={form.price_per_box} onChange={(e: any) => setForm({ ...form, price_per_box: e.target.value })} placeholder="0" />
                    <Input label={isBottleMedicine ? t('products.pricePerBottle') : (isBandageType || isGeneralType) ? "Price per pack" : t('products.pricePerStrip')} prefix="₹" type="number" value={form.price_per_strip} onChange={(e: any) => setForm({ ...form, price_per_strip: e.target.value })} placeholder="0" />
                    <Input label={isBandageType ? "Price per bandage" : isGeneralType ? "Price per piece" : t('products.pricePerTablet')} prefix="₹" type="number" value={form.price_per_tablet} onChange={(e: any) => setForm({ ...form, price_per_tablet: e.target.value })} placeholder="0" />
                  </div>
                </div>
                )}

                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.batches')}</div>
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className={`grid ${isSimpleType ? "grid-cols-2" : "grid-cols-3"} gap-x-4 gap-y-3`}>
                        <Input label={t('products.batchNo')} value={form.batch_number} onChange={(e: any) => setForm({ ...form, batch_number: e.target.value })} placeholder="e.g. B001" />
                        {isBottleMedicine && (
                          <Input label={t('products.bottles')} type="number" value={form.bottles} onChange={(e: any) => {
                            const b = Number(e.target.value) || 0;
                            const tps = Number(form.tablets_per_strip) || 1;
                            const newTotal = String(b * tps);
                            setForm({ ...form, bottles: e.target.value, total_tablets: newTotal, strips: String(b) });
                          }} placeholder="0" />
                        )}
                        {!isSimpleType && !isBottleMedicine && (
                          <Input label={(isBandageType || isGeneralType) ? "Packs" : t('products.strips')} type="number" value={form.strips} onChange={(e: any) => {
                            const s = Number(e.target.value) || 0;
                            const tps = Number(form.tablets_per_strip) || 1;
                            setForm({ ...form, strips: e.target.value, total_tablets: String(s * tps) });
                          }} placeholder="0" />
                        )}
                        <Input label={isSimpleType ? t('products.totalProductsSimple') : isBandageType ? "Total Bandages" : isGeneralType ? "Total Pieces" : t('products.totalTablets')} type="number" value={form.total_tablets} className={!isSimpleType && ((Number(form.total_tablets) || 0) + batchRows.reduce((s, r) => s + (Number(r.total_tablets) || 0), 0)) > ((Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(form.extra_tablets) || 0)) ? "border-red-400 focus:ring-red-500/20 focus:border-red-400" : ""} onChange={(e: any) => { setForm({ ...form, total_tablets: e.target.value, strips: String(Math.round((Number(e.target.value) || 0) / ((Number(form.tablets_per_strip) || 0) || 1))), bottles: String(Math.floor((Number(e.target.value) || 0) / ((Number(form.tablets_per_strip) || 0) || 1))) }); }} placeholder="0" />
                        <Input label={t('products.ptr')} type="number" step="0.01" value={form.ptr} onChange={(e: any) => setForm({ ...form, ptr: e.target.value })} placeholder="0.00" />
                        
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.mfgDate')}</label>
                          <div className="relative">
                            <button
                              ref={mfgBtnRef}
                              type="button"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                setMfgPickPos({ top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                setMfgShowPicker(!mfgShowPicker);
                              }}
                              className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                            >
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                              <span>{form.manufacture_date ? format(new Date(form.manufacture_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                            </button>
                            {mfgShowPicker && (
                              <div id="mfg-cal-popup" className="fixed z-[70]" style={{ top: mfgPickPos.top, right: mfgPickPos.right }}>
                                <SimpleDatePicker date={form.manufacture_date ? new Date(form.manufacture_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, manufacture_date: format(d, "yyyy-MM-dd") }); setMfgShowPicker(false); }} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.expiryDate')}</label>
                          <div className="relative">
                            <button
                              ref={expiryBtnRef}
                              type="button"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                setExpiryPickPos({ top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                setExpiryShowPicker(!expiryShowPicker);
                              }}
                              className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                            >
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                              <span>{form.expiry_date ? format(new Date(form.expiry_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
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
                          onClick={(e) => confirmDeleteBatch(e, row.id)}
                          className="absolute -top-2 -right-2 w-7 h-7 bg-red-50 border border-red-200 rounded-full flex items-center justify-center text-red-500 hover:bg-red-100 text-sm transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <div className={`grid ${isSimpleType ? "grid-cols-2" : "grid-cols-3"} gap-x-4 gap-y-3`}>
                          <Input label={t('products.batchNo')} value={row.batch_number} onChange={(e: any) => updateBatchRow(row.id, "batch_number", e.target.value)} placeholder="e.g. B002" />
                          {isBottleMedicine && (
                            <Input label={t('products.bottles')} type="number" value={row.bottles} onChange={(e: any) => updateBatchRow(row.id, "bottles", e.target.value)} placeholder="0" />
                          )}
                          {!isSimpleType && !isBottleMedicine && (
                            <Input label={(isBandageType || isGeneralType) ? "Packs" : t('products.strips')} type="number" value={row.strips} onChange={(e: any) => updateBatchRow(row.id, "strips", e.target.value)} placeholder="0" />
                          )}
                          <Input label={isSimpleType ? t('products.totalProductsSimple') : isBandageType ? "Total Bandages" : isGeneralType ? "Total Pieces" : t('products.totalTablets')} type="number" value={row.total_tablets} className={!isSimpleType && ((Number(form.total_tablets) || 0) + batchRows.slice(0, idx).reduce((s, r) => s + (Number(r.total_tablets) || 0), 0) + (Number(row.total_tablets) || 0)) > ((Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(form.extra_tablets) || 0)) ? "border-red-400 focus:ring-red-500/20 focus:border-red-400" : ""} onChange={(e: any) => updateBatchRow(row.id, "total_tablets", e.target.value)} placeholder="0" />
                          <Input label={t('products.ptr')} type="number" step="0.01" value={row.ptr} onChange={(e: any) => updateBatchRow(row.id, "ptr", e.target.value)} placeholder="0.00" />
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.mfgDate')}</label>
                            <div className="relative">
                              <button
                                type="button"
                                className="batch-date-btn flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                onClick={(e) => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                  setBatchDatePicker({ id: row.id, field: 'mfg', top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                }}
                              >
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span>{row.manufacture_date ? format(new Date(row.manufacture_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.expiryDate')}</label>
                            <div className="relative">
                              <button
                                type="button"
                                className="batch-date-btn flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                onClick={(e) => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                  setBatchDatePicker({ id: row.id, field: 'exp', top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                }}
                              >
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span>{row.expiry_date ? format(new Date(row.expiry_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                              </button>
                            </div>
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
                    {t('products.addBatch')}
                  </button>
                </div>

                {/* Image */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.image')}</label>
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
                      onDrop={async (e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f && f.type.startsWith("image/")) {
                          try {
                            const dataUrl = await compressImage(f);
                            setForm({ ...form, image: dataUrl });
                          } catch { /* ignore */ }
                        }
                      }}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
                    >
                      <svg className="w-10 h-10 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-slate-500 font-medium">{t('products.clickOrDrag')}</p>
                      <p className="text-xs text-slate-400 mt-1">{t('products.supportedFormats')}</p>
                      <input
                        id="product-image-input"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f && f.type.startsWith("image/")) {
                            try {
                              const dataUrl = await compressImage(f);
                              setForm({ ...form, image: dataUrl });
                            } catch { /* ignore */ }
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
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('products.purchaseDetails')}</div>
                      {!showNewPurchase && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewSupplierSearch("");
                            setNewSupplierDropdownOpen(false);
                            setShowNewPurchase(true);
                            // Auto-select new batches (those without batch_uuid in batchRows)
                            const newIds = batchRows.filter(r => !r.batch_uuid).map(r => r.id);
                            setNewPurchaseBatchIds(newIds);
                          }}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 border border-emerald-300 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition-all"
                        >
                          {t('products.addNewDetails')}
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.supplier')}</span><span>{supplierSearch || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.invoiceNo')}</span><span>{form.invoice_number || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.invoiceDate')}</span><span>{form.invoice_date ? format(new Date(form.invoice_date + "T00:00:00"), "dd MMM yyyy") : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.discount')}</span><span>₹{Number(form.purchase_discount || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span className="font-medium">{t('products.subtotal')}</span><span className="font-bold text-emerald-600">₹{Number(form.purchase_total || 0).toFixed(2)}</span></div>
                    </div>
                    {showNewPurchase && (
                      <>
                        <hr className="border-slate-200 my-4" />
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.newPurchaseDetails')}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          {/* Supplier Combobox */}
                          <div className="relative">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.supplier')}</label>
                            <input
                              type="text"
                              value={newSupplierSearch}
                              onChange={(e) => { setNewSupplierSearch(e.target.value); setNewSupplierDropdownOpen(true); if (!e.target.value) setForm({ ...form, supplier_uuid: "" }); }}
                              onFocus={() => setNewSupplierDropdownOpen(true)}
                              placeholder={t('products.searchOrTypeSupplier')}
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
                                          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('products.recentSuppliers')}</div>
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
                                          <div className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100 text-center">{t('products.typeToSearchAll')}</div>
                                        </>
                                      ) : (
                                <div className="px-4 py-6 text-center text-sm text-slate-400">{t('products.typeToSearch')}</div>
                                      )
                                    ) : (
                                      <>
                                        {suppliers.filter(s => s.name.toLowerCase().includes(newSupplierSearch.toLowerCase())).length === 0 ? (
                                          <div className="px-4 py-6 text-center text-sm text-slate-400">{t('products.noSuppliersFound')}</div>
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
                                            {t('products.addAsNewSupplier', { name: newSupplierSearch.trim() })}
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          <Input label={t('products.invoiceNumber')} value={newInvoiceNumber} onChange={(e: any) => setNewInvoiceNumber(e.target.value)} placeholder="e.g. INV-001" />
                          {/* Invoice Date */}
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.invoiceDate')}</label>
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
                                <span>{newInvoiceDate ? format(new Date(newInvoiceDate + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                              </button>
                              {newInvoiceShowPicker && (
                                <div id="new-inv-cal-popup" className="fixed z-[70]" style={{ top: newInvoicePickPos.top, right: newInvoicePickPos.right }}>
                                  <SimpleDatePicker date={newInvoiceDate ? new Date(newInvoiceDate + "T00:00:00") : undefined} onSelect={(d) => { setNewInvoiceDate(format(d, "yyyy-MM-dd")); setNewInvoiceShowPicker(false); }} />
                                </div>
                              )}
                            </div>
                          </div>
                          <Input label={t('products.supplierDiscount')} type="number" value={newPurchaseDiscount} onChange={(e: any) => { setNewPurchaseDiscount(e.target.value); setNewManualSubtotal(null); }} placeholder="0" />
                          {/* Batch Selector */}
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Select Batches</label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setNewPurchaseBatchOpen(!newPurchaseBatchOpen)}
                                className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                              >
                                <span>{newPurchaseBatchIds.length} batch{newPurchaseBatchIds.length !== 1 ? "es" : ""} selected</span>
                                <svg className={`w-4 h-4 text-slate-400 transition-transform ${newPurchaseBatchOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              {newPurchaseBatchOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setNewPurchaseBatchOpen(false)} />
                                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ position: 'absolute' }}>
                                    <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                      {(() => {
                                        const options: { id: string; batch_number: string; strips: string; total_tablets: string; ptr: string; isNew: boolean }[] = [];
                                        if (form.batch_number || form.strips) {
                                          options.push({ id: 'form-batch', batch_number: form.batch_number || "-", strips: form.strips, total_tablets: form.total_tablets, ptr: form.ptr, isNew: !editingBatchUuid });
                                        }
                                        for (const row of batchRows) {
                                          if (row.batch_number) {
                                            options.push({ id: row.id, batch_number: row.batch_number, strips: row.strips, total_tablets: row.total_tablets, ptr: row.ptr, isNew: !row.batch_uuid });
                                          }
                                        }
                                        if (options.length === 0) {
                                          return <div className="px-4 py-6 text-center text-sm text-slate-400">No batches available</div>;
                                        }
                                        return options.map((opt) => (
                                          <label
                                            key={opt.id}
                                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={newPurchaseBatchIds.includes(opt.id)}
                                              onChange={() => {
                                                setNewPurchaseBatchIds(prev =>
                                                  prev.includes(opt.id)
                                                    ? prev.filter(id => id !== opt.id)
                                                    : [...prev, opt.id]
                                                );
                                              }}
                                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm text-slate-800 font-medium">{opt.batch_number}</div>
                                              <div className="text-xs text-slate-400">{opt.total_tablets} tablets · ₹{opt.ptr} PTR{opt.isNew ? <span className="text-emerald-500 ml-1">new</span> : ""}</div>
                                            </div>
                                          </label>
                                        ));
                                      })()}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Subtotal */}
                        {(() => {
                          const displayValue = newManualSubtotal !== null ? newManualSubtotal : "";
                          return (
                            <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-200 mt-4">
                        <span className="text-sm font-medium text-slate-600">{t('products.subtotal')}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">₹</span>
                                  <input
                                  type="number"
                                  step="0.01"
                                  value={displayValue}
                                  onChange={(e) => setNewManualSubtotal(e.target.value)}
                                  onWheel={(e) => { e.preventDefault(); (e.target as HTMLElement).blur(); }}
                                  placeholder="0"
                                  className="w-32 text-right bg-transparent border-b border-slate-300 text-2xl font-bold text-emerald-600 focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
    setNewPurchaseBatchIds([]);
                            setNewInvoiceNumber("");
                            setNewInvoiceDate("");
                            setNewPurchaseDiscount("");
                            setNewManualSubtotal(null);
                            setNewPurchaseBatchIds([]);
                          }}
                          className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          {t('products.cancelNewDetails')}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                <>
                <hr className="border-slate-200 my-4" />
                  <div className="border border-slate-200 rounded-xl p-5 bg-white">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">{t('products.purchaseDetails')}</div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {/* Supplier Combobox */}
                    <div className="relative">
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.supplier')}</label>
                      <input
                        type="text"
                        value={supplierSearch}
                        onChange={(e) => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setForm({ ...form, supplier_uuid: "" }); }}
                        onFocus={() => setSupplierDropdownOpen(true)}
                        placeholder={t('products.searchOrTypeSupplier')}
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
                                      {t('products.addAsNewSupplier', { name: supplierSearch.trim() })}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <Input label={t('products.invoiceNumber')} value={form.invoice_number} onChange={(e: any) => setForm({ ...form, invoice_number: e.target.value })} placeholder="e.g. INV-001" />
                    {/* Invoice Date */}
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.invoiceDate')}</label>
                      <div className="relative">
                          <button
                            ref={invoiceBtnRef}
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                              setInvoicePickPos({ top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                              setInvoiceShowPicker(!invoiceShowPicker);
                            }}
                            className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                          >
                            <CalendarIcon className="w-4 h-4 text-slate-400" />
                            <span>{form.invoice_date ? format(new Date(form.invoice_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                          </button>
                          {invoiceShowPicker && (
                            <div id="inv-cal-popup" className="fixed z-[70]" style={{ top: invoicePickPos.top, right: invoicePickPos.right }}>
                            <SimpleDatePicker date={form.invoice_date ? new Date(form.invoice_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, invoice_date: format(d, "yyyy-MM-dd") }); setInvoiceShowPicker(false); }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <Input label={t('products.supplierDiscount')} type="number" value={form.purchase_discount} onChange={(e: any) => { setForm({ ...form, purchase_discount: e.target.value }); setManualSubtotal(null); }} placeholder="0" />
                  </div>

                  {/* Subtotal */}
                  {(() => {
                    const displayValue = manualSubtotal !== null ? manualSubtotal : "";
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
                            placeholder="0"
                            onWheel={(e) => { e.preventDefault(); (e.target as HTMLElement).blur(); }}
                            className="w-32 text-right bg-transparent border-b border-slate-300 text-2xl font-bold text-emerald-600 focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

      {deleteBatchConfirm && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setDeleteBatchConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 border border-red-200" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Batch</h3>
              <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this batch?</p>
              {(() => {
                const batch = batchRows.find(r => r.id === deleteBatchConfirm);
                if (!batch) return null;
                return (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden mb-5">
                    <table className="w-full text-xs">
                      <tbody>
                        <tr className="border-b border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-500 text-start w-1/3">Batch No</td>
                          <td className="px-3 py-2 text-slate-800 text-start">{batch.batch_number || "-"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-500 text-start">Total</td>
                          <td className="px-3 py-2 text-slate-800 text-start">{batch.total_tablets || "0"}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-500 text-start">PTR</td>
                          <td className="px-3 py-2 text-slate-800 text-start">₹{Number(batch.ptr || 0).toFixed(2)}</td>
                        </tr>
                        <tr className="border-b border-slate-200">
                          <td className="px-3 py-2 font-medium text-slate-500 text-start">Mfg Date</td>
                          <td className="px-3 py-2 text-slate-800 text-start">{batch.manufacture_date ? format(new Date(batch.manufacture_date + "T00:00:00"), "dd MMM yyyy") : "-"}</td>
                        </tr>
                        <tr>
                          <td className="px-3 py-2 font-medium text-slate-500 text-start">Expiry Date</td>
                          <td className="px-3 py-2 text-slate-800 text-start">{batch.expiry_date ? format(new Date(batch.expiry_date + "T00:00:00"), "dd MMM yyyy") : "-"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })()}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteBatchConfirm(null)}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >Cancel</button>
                <button
                  type="button"
                  onClick={() => { removeBatchRow(deleteBatchConfirm); setDeleteBatchConfirm(null); }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
                >Delete</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {batchDatePicker && createPortal(
        <div id="batch-date-popup" className="fixed z-[70]" style={{ top: batchDatePicker.top, right: batchDatePicker.right }}>
          <SimpleDatePicker
            date={batchDatePicker.field === 'mfg' ? (batchRows.find(r => r.id === batchDatePicker.id)?.manufacture_date ? new Date(batchRows.find(r => r.id === batchDatePicker.id)!.manufacture_date + "T00:00:00") : undefined) : (batchRows.find(r => r.id === batchDatePicker.id)?.expiry_date ? new Date(batchRows.find(r => r.id === batchDatePicker.id)!.expiry_date + "T00:00:00") : undefined)}
            onSelect={(d) => {
              const val = format(d, "yyyy-MM-dd");
              if (batchDatePicker.field === 'mfg') {
                updateBatchRow(batchDatePicker.id, "manufacture_date", val);
              } else {
                updateBatchRow(batchDatePicker.id, "expiry_date", val);
              }
              setBatchDatePicker(null);
            }}
            disableFuture={batchDatePicker.field === 'mfg'}
          />
        </div>,
        document.body
      )}

    </div>
  );
}
