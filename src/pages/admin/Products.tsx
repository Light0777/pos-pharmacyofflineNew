import React, { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
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
import ImportSupplierInvoiceModal from "../../components/ImportSupplierInvoiceModal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { Product, BatchRow } from "../../components/products/constants";
import {
  GST_OPTIONS, SCHEDULE_TYPES, CATEGORY_OPTIONS, CATEGORY_DEFAULTS,
  UNIT_OPTIONS, EMPTY_FORM,
} from "../../components/products/constants";
import {
  Badge, Spinner, Tooltip, Select, Input, Toggle, Dropdown, compressImage,
} from "../../components/products/ui";
import BatchInfoModal from "../../components/products/BatchInfoModal";
import ProductFormModal from "../../components/products/ProductFormModal";
import ProductListView from "../../components/products/ProductListView";

// ─── Main Products Component ──────────────────────────────────────────────
export default function Products() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingBatchUuid, setEditingBatchUuid] = useState<string | null>(null);
  const [editingPurchaseUuid, setEditingPurchaseUuid] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out" | "expired">("all");
  const [expiredProductUuids, setExpiredProductUuids] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
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

      <ProductListView
        products={products}
        filteredProducts={filteredProducts}
        paginatedProducts={paginatedProducts}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        stockFilter={stockFilter}
        setStockFilter={setStockFilter}
        sortField={sortField}
        sortDir={sortDir}
        handleSort={handleSort}
        selectedRows={selectedRows}
        toggleRow={toggleRow}
        toggleAll={toggleAll}
        user={user}
        handleEdit={handleEdit}
        setDeleteConfirm={setDeleteConfirm}
        handleQuarantineExpired={handleQuarantineExpired}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        filters={filters}
        setFilters={setFilters}
        filterFromDate={filterFromDate}
        setFilterFromDate={setFilterFromDate}
        filterToDate={filterToDate}
        setFilterToDate={setFilterToDate}
        filterFromShowPicker={filterFromShowPicker}
        setFilterFromShowPicker={setFilterFromShowPicker}
        filterToShowPicker={filterToShowPicker}
        setFilterToShowPicker={setFilterToShowPicker}
        filterFromPickPos={filterFromPickPos}
        setFilterFromPickPos={setFilterFromPickPos}
        filterToPickPos={filterToPickPos}
        setFilterToPickPos={setFilterToPickPos}
        filterFromBtnRef={filterFromBtnRef}
        filterToBtnRef={filterToBtnRef}
        batchInfo={batchInfo}
        loadBatchInfo={loadBatchInfo}
        expiredProductUuids={expiredProductUuids}
        pageP={pageP}
        setPageP={setPageP}
        totalPages={totalPages}
        pageSize={pageSize}
        showStats={showStats}
        setSelectedStat={setSelectedStat}
        totalProducts={totalProducts}
        lowStockProducts={lowStockProducts}
        outOfStockProducts={outOfStockProducts}
        totalInventoryValue={totalInventoryValue}
        showImport={showImport}
        setShowImport={setShowImport}
        getProductBatches={getProductBatches}
        setShowForm={setShowForm}
        resetForm={resetForm}
        setError={setError}
        setFormKey={setFormKey}
        hasActiveFilters={hasActiveFilters}
        setAllBatchesMap={setAllBatchesMap}
        onImported={() => { setShowImport(false); loadProducts(); }}
        quarantining={quarantining}
      />



      {/* Import Supplier Invoice Modal */}
      {showImport && (
        <ImportSupplierInvoiceModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); loadProducts(); }}
        />
      )}

      {/* Product Form Modal */}
      {showForm && createPortal(
        <ProductFormModal
          form={form}
          setForm={setForm}
          formKey={formKey}
          error={error}
          editing={editing}
          editingBatchUuid={editingBatchUuid}
          loading={loading}
          isSimpleType={isSimpleType}
          isBottleMedicine={isBottleMedicine}
          isBandageType={isBandageType}
          isGeneralType={isGeneralType}
          batchRows={batchRows}
          addBatchRow={addBatchRow}
          updateBatchRow={updateBatchRow}
          removeBatchRow={removeBatchRow}
          deleteBatchConfirm={deleteBatchConfirm}
          setDeleteBatchConfirm={setDeleteBatchConfirm}
          confirmDeleteBatch={confirmDeleteBatch}
          user={user}
          deleting={deleting}
          setDeleteConfirm={setDeleteConfirm}
          mfgBtnRef={mfgBtnRef}
          mfgShowPicker={mfgShowPicker}
          setMfgShowPicker={setMfgShowPicker}
          mfgPickPos={mfgPickPos}
          setMfgPickPos={setMfgPickPos}
          expiryBtnRef={expiryBtnRef}
          expiryShowPicker={expiryShowPicker}
          setExpiryShowPicker={setExpiryShowPicker}
          expiryPickPos={expiryPickPos}
          setExpiryPickPos={setExpiryPickPos}
          invoiceBtnRef={invoiceBtnRef}
          invoiceShowPicker={invoiceShowPicker}
          setInvoiceShowPicker={setInvoiceShowPicker}
          invoicePickPos={invoicePickPos}
          setInvoicePickPos={setInvoicePickPos}
          suppliers={suppliers}
          supplierSearch={supplierSearch}
          setSupplierSearch={setSupplierSearch}
          supplierDropdownOpen={supplierDropdownOpen}
          setSupplierDropdownOpen={setSupplierDropdownOpen}
          recentSuppliers={recentSuppliers}
          setRecentSuppliers={setRecentSuppliers}
          manualSubtotal={manualSubtotal}
          setManualSubtotal={setManualSubtotal}
          resetForm={resetForm}
          setMissClickToast={setMissClickToast}
          handleSubmit={handleSubmit}
          showNewPurchase={showNewPurchase}
          setShowNewPurchase={setShowNewPurchase}
          newSupplierSearch={newSupplierSearch}
          setNewSupplierSearch={setNewSupplierSearch}
          newSupplierDropdownOpen={newSupplierDropdownOpen}
          setNewSupplierDropdownOpen={setNewSupplierDropdownOpen}
          newInvoiceNumber={newInvoiceNumber}
          setNewInvoiceNumber={setNewInvoiceNumber}
          newInvoiceDate={newInvoiceDate}
          setNewInvoiceDate={setNewInvoiceDate}
          newPurchaseDiscount={newPurchaseDiscount}
          setNewPurchaseDiscount={setNewPurchaseDiscount}
          newManualSubtotal={newManualSubtotal}
          setNewManualSubtotal={setNewManualSubtotal}
          newPurchaseBatchIds={newPurchaseBatchIds}
          setNewPurchaseBatchIds={setNewPurchaseBatchIds}
          newPurchaseBatchOpen={newPurchaseBatchOpen}
          setNewPurchaseBatchOpen={setNewPurchaseBatchOpen}
          newInvoiceBtnRef={newInvoiceBtnRef}
          newInvoiceShowPicker={newInvoiceShowPicker}
          setNewInvoiceShowPicker={setNewInvoiceShowPicker}
          newInvoicePickPos={newInvoicePickPos}
          setNewInvoicePickPos={setNewInvoicePickPos}
          setSuppliers={setSuppliers}
          units={units}
          handleAddUnit={handleAddUnit}
          handleDeleteUnit={handleDeleteUnit}
          showUnitForm={showUnitForm}
          setShowUnitForm={setShowUnitForm}
          unitForm={unitForm}
          setUnitForm={setUnitForm}
          editingPurchaseUuid={editingPurchaseUuid}
          products={products}
          batchDatePicker={batchDatePicker}
          setBatchDatePicker={setBatchDatePicker}
          missClickToast={missClickToast}
          onClose={resetForm}
        />
      , document.body)}

      {missClickToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-xl text-sm text-amber-800 bg-amber-50 border border-amber-200 shadow-lg animate-pulse">
          Safety miss-click activated â€” use âœ• button to close
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
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">â‚¹{Math.round(totalInventoryValue).toLocaleString()}</p>
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

      {batchModalProduct && (
        <BatchInfoModal
          batches={batchModalProduct.batches}
          onClose={() => setBatchModalProduct(null)}
        />
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
                          <td className="px-3 py-2 text-slate-800 text-start">â‚¹{Number(batch.ptr || 0).toFixed(2)}</td>
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

