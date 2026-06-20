import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  EyeIcon,
  UndoIcon,
  CheckmarkCircle01Icon,
  Search01Icon,
  FunnelIcon,
} from "@hugeicons/core-free-icons";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import SimpleDatePicker from "../../../components/SimpleDatePicker";
import { createMedicineReturn } from "../../../renderer/services/medicineReturnApi";
import { getInvoice } from "../../../renderer/services/saleApi";

interface SalesModalProps {
  sales: any[];
  onClose: () => void;
  onViewInvoice: (saleUUID: string) => void;
  onRefresh?: () => void;
}

export default function SalesModal({ sales, onClose, onViewInvoice, onRefresh }: SalesModalProps) {
  const [returnTarget, setReturnTarget] = useState<any | null>(null);
  const [returnForm, setReturnForm] = useState({ product_uuid: "", batch_uuid: "", quantity: 1, reason: "", refund_amount: 0 });
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);

  const [invoiceItems, setInvoiceItems] = useState<any[] | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
    minAmount: "",
    maxAmount: "",
  });
  const [page, setPage] = useState(1);
  const ROWS_PER_PAGE = 10;

  // Date picker state
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const fromBtnRef = useRef<HTMLButtonElement>(null);
  const toBtnRef = useRef<HTMLButtonElement>(null);
  const [fromPickPos, setFromPickPos] = useState({ top: 0, right: 0 });
  const [toPickPos, setToPickPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (!showFromPicker || !fromBtnRef.current) return;
    const rect = fromBtnRef.current.getBoundingClientRect();
    setFromPickPos({ top: rect.bottom + 6, right: document.documentElement.clientWidth - rect.right });
    const handleClick = (e: MouseEvent) => {
      if (fromBtnRef.current && !fromBtnRef.current.contains(e.target as Node) && !(e.target as Element)?.closest?.(".cal-card")) {
        setShowFromPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFromPicker]);

  useEffect(() => {
    if (!showToPicker || !toBtnRef.current) return;
    const rect = toBtnRef.current.getBoundingClientRect();
    setToPickPos({ top: rect.bottom + 6, right: document.documentElement.clientWidth - rect.right });
    const handleClick = (e: MouseEvent) => {
      if (toBtnRef.current && !toBtnRef.current.contains(e.target as Node) && !(e.target as Element)?.closest?.(".cal-card")) {
        setShowToPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showToPicker]);

  const filteredSales = useMemo(() => {
    let result = sales;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => {
        const dateStr = s.created_at
          ? new Date(s.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : "";
        const invNum = (s.invoice_number || s.sale_uuid?.slice(0, 8) || "").toLowerCase();
        const customer = (s.customer_name || s.customer?.name || "Walk-in").toLowerCase();
        return dateStr.includes(q) || invNum.includes(q) || customer.includes(q);
      });
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((s) => s.created_at && new Date(s.created_at) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((s) => s.created_at && new Date(s.created_at) <= to);
    }
    if (filters.minAmount) {
      result = result.filter((s) => Number(s.grand_total || 0) >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount) {
      result = result.filter((s) => Number(s.grand_total || 0) <= parseFloat(filters.maxAmount));
    }

    return result;
  }, [sales, searchQuery, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * ROWS_PER_PAGE;
  const paginatedSales = filteredSales.slice(start, start + ROWS_PER_PAGE);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filters]);

  useEffect(() => {
    if (!returnTarget) {
      setInvoiceItems(null);
      setSelectedItemIndex(null);
      return;
    }

    let cancelled = false;
    const loadItems = async () => {
      setInvoiceLoading(true);
      setSelectedItemIndex(null);
      try {
        const invoice = await getInvoice(returnTarget.sale_uuid);
        if (cancelled) return;
        const items = invoice?.items || [];
        setInvoiceItems(items);
        if (items.length === 1) {
          setSelectedItemIndex(0);
          setReturnForm((prev) => ({
            ...prev,
            product_uuid: items[0].product_uuid || "",
            batch_uuid: items[0].batch_uuid || "",
            quantity: items[0].quantity || 1,
            refund_amount: (items[0].price || 0) * (items[0].quantity || 1),
          }));
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load invoice items:", err);
          setInvoiceItems([]);
        }
      } finally {
        if (!cancelled) setInvoiceLoading(false);
      }
    };
    loadItems();
    return () => { cancelled = true; };
  }, [returnTarget]);

  const handleReturnSubmit = async () => {
    if (!returnForm.product_uuid || !returnForm.batch_uuid || !returnForm.quantity) {
      setReturnError("Product, batch, and quantity are required");
      return;
    }

    // Client-side quantity check against sold quantity
    if (selectedItemIndex !== null && invoiceItems?.[selectedItemIndex]) {
      const soldQty = Number(invoiceItems[selectedItemIndex].quantity) || 0;
      if (returnForm.quantity > soldQty) {
        setReturnError(`Cannot return more than ${soldQty} item(s) — only ${soldQty} were sold`);
        return;
      }
    }

    setReturnSaving(true);
    setReturnError(null);
    try {
      const result = await createMedicineReturn({
        sale_uuid: returnTarget?.sale_uuid,
        product_uuid: returnForm.product_uuid,
        batch_uuid: returnForm.batch_uuid,
        return_type: "customer_return",
        quantity: returnForm.quantity,
        refund_amount: returnForm.refund_amount,
        reason: returnForm.reason || undefined,
      });
      setReturnSuccess("Return processed successfully!");
      window.dispatchEvent(new Event("refresh-dashboard"));
      onRefresh?.();
      setTimeout(() => { setReturnSuccess(null); setReturnTarget(null); }, 1500);
    } catch (err: any) {
      setReturnError(err.message || "Return failed");
    } finally {
      setReturnSaving(false);
    }
  };

  const handleSelectItem = (index: number, item: any) => {
    setSelectedItemIndex(index);
    setReturnForm((prev) => ({
      ...prev,
      product_uuid: item.product_uuid || "",
      batch_uuid: item.batch_uuid || "",
      quantity: item.quantity || 1,
      refund_amount: (item.price || 0) * (item.quantity || 1),
    }));
  };

  const clearFilters = () => {
    setFilters({ dateFrom: undefined, dateTo: undefined, minAmount: "", maxAmount: "" });
    setSearchQuery("");
  };

  const hasActiveFilters = filters.dateFrom || filters.dateTo || filters.minAmount || filters.maxAmount;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Sales History</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {filteredSales.length} of {sales.length} sale{sales.length !== 1 ? "s" : ""}
                {totalPages > 1 && (
                  <span className="ml-2 text-slate-300">· Page {safePage} of {totalPages}</span>
                )}
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search + Filter */}
          <div className="px-6 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 inset-y-0 flex items-center text-slate-400 pointer-events-none">
                  <HugeiconsIcon icon={Search01Icon} className="text-base"  />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by date, invoice#, or customer..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 inset-y-0 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`relative p-2 text-sm transition-all ${
                  hasActiveFilters ? "text-blue-500" : "text-slate-400 hover:text-slate-600"
                }`}
                title="Filters"
              >
                <HugeiconsIcon icon={FunnelIcon} className="text-lg"  />
                {hasActiveFilters && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {(filters.dateFrom ? 1 : 0) + (filters.dateTo ? 1 : 0) + (filters.minAmount ? 1 : 0) + (filters.maxAmount ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">From Date</label>
                    <div className="relative">
                      <button
                        ref={fromBtnRef}
                        type="button"
                        onClick={() => setShowFromPicker(!showFromPicker)}
                        className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors"
                      >
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                        <span>{filters.dateFrom ? format(filters.dateFrom, "dd MMM yyyy") : "From"}</span>
                      </button>
                      {filters.dateFrom && (
                        <button
                          onClick={() => setFilters((p) => ({ ...p, dateFrom: undefined }))}
                          className="absolute -right-2 -top-2 w-5 h-5 bg-slate-300 hover:bg-slate-400 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      {showFromPicker && (
                        <div className="fixed z-[70]" style={{ top: fromPickPos.top, right: fromPickPos.right }}>
                          <SimpleDatePicker
                            date={filters.dateFrom || new Date()}
                            onSelect={(d) => { setFilters((p) => ({ ...p, dateFrom: d })); setShowFromPicker(false); }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">To Date</label>
                    <div className="relative">
                      <button
                        ref={toBtnRef}
                        type="button"
                        onClick={() => setShowToPicker(!showToPicker)}
                        className="flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors"
                      >
                        <CalendarIcon className="w-4 h-4 text-slate-400" />
                        <span>{filters.dateTo ? format(filters.dateTo, "dd MMM yyyy") : "To"}</span>
                      </button>
                      {filters.dateTo && (
                        <button
                          onClick={() => setFilters((p) => ({ ...p, dateTo: undefined }))}
                          className="absolute -right-2 -top-2 w-5 h-5 bg-slate-300 hover:bg-slate-400 text-white rounded-full flex items-center justify-center transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                      {showToPicker && (
                        <div className="fixed z-[70]" style={{ top: toPickPos.top, right: toPickPos.right }}>
                          <SimpleDatePicker
                            date={filters.dateTo || new Date()}
                            onSelect={(d) => { setFilters((p) => ({ ...p, dateTo: d })); setShowToPicker(false); }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Min Amount</label>
                    <input
                      type="number"
                      min="0"
                      value={filters.minAmount}
                      onChange={(e) => setFilters((p) => ({ ...p, minAmount: e.target.value }))}
                      placeholder="₹0"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Max Amount</label>
                    <input
                      type="number"
                      min="0"
                      value={filters.maxAmount}
                      onChange={(e) => setFilters((p) => ({ ...p, maxAmount: e.target.value }))}
                      placeholder="₹99999"
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-all"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Date</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Invoice #</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Customer</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Amount</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Refund</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Action</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Return</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSales.map((sale) => {
                  const statusMap: Record<string, { label: string; classes: string }> = {
                    completed: { label: "Paid", classes: "bg-green-100 text-green-700" },
                    paid: { label: "Paid", classes: "bg-green-100 text-green-700" },
                    pending: { label: "Pending", classes: "bg-amber-100 text-amber-700" },
                    cancelled: { label: "Cancelled", classes: "bg-red-100 text-red-600" },
                  };
                  const st = statusMap[sale.status] || { label: "Completed", classes: "bg-green-100 text-green-700" };
                  return (
                    <tr key={sale.sale_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 text-gray-500">
                        {sale.created_at
                          ? new Date(sale.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 font-medium text-blue-600">
                        #{sale.invoice_number || sale.sale_uuid?.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-800">{sale.customer_name || sale.customer?.name || "Walk-in"}</p>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-gray-800">
                        ₹{Number(sale.grand_total || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {Number(sale.refund_total) > 0 ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                            -₹{Number(sale.refund_total).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${st.classes}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => onViewInvoice(sale.sale_uuid)}
                          className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md p-1.5 transition-colors"
                          title="View invoice"
                        >
                          <HugeiconsIcon icon={EyeIcon} className="text-lg"  />
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button
                          onClick={() => { setReturnTarget(sale); setReturnForm({ product_uuid: "", batch_uuid: "", quantity: 1, reason: "", refund_amount: 0 }); setReturnError(null); setReturnSuccess(null); }}
                          className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                          title="Process return"
                        >
                          Return
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">No sales found</td>
                  </tr>
                )}
              </tbody>
            </table>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Showing {start + 1}–{Math.min(start + ROWS_PER_PAGE, filteredSales.length)} of {filteredSales.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    ‹ Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => {
                      if (totalPages <= 7) return true;
                      if (p === 1 || p === totalPages) return true;
                      if (Math.abs(p - safePage) <= 1) return true;
                      return false;
                    })
                    .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                      if (idx > 0) {
                        const prev = arr[idx - 1];
                        if (p - prev > 1) acc.push("ellipsis");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "ellipsis" ? (
                        <span key={`e${idx}`} className="px-1.5 text-slate-400 text-xs">...</span>
                      ) : (
                        <button
                          key={item}
                          onClick={() => setPage(item)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            item === safePage
                              ? "bg-green-500 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Return Dialog */}
      {returnTarget && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={(e) => { if (e.target === e.currentTarget) setReturnTarget(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Process Return</h3>
                <p className="text-xs text-slate-400 mt-0.5">#{returnTarget.invoice_number || returnTarget.sale_uuid?.slice(0, 8)}</p>
              </div>
              <button onClick={() => setReturnTarget(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {returnSuccess ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {returnSuccess}
                </div>
              ) : invoiceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-600 border-t-transparent" />
                  <span className="ml-3 text-sm text-slate-500">Loading invoice items...</span>
                </div>
              ) : (
                <>
                  {returnError && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {returnError}
                    </div>
                  )}

                  {/* Item Selector */}
                  {invoiceItems && invoiceItems.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                        Select Item from Invoice
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {invoiceItems.map((item: any, idx: number) => {
                          const isSelected = selectedItemIndex === idx;
                          const hasBatch = !!item.batch_uuid;
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={!hasBatch}
                              onClick={() => hasBatch && handleSelectItem(idx, item)}
                              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                isSelected
                                  ? "border-amber-500 bg-amber-50"
                                  : hasBatch
                                    ? "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50"
                                    : "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                  isSelected ? "border-amber-500 bg-amber-500" : "border-slate-300"
                                }`}>
                                  {isSelected && (
                                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-white text-sm"  />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">
                                    {item.product_name || item.name || "Unknown Product"}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                    {hasBatch && (
                                      <span>Batch: <span className="font-medium text-slate-700">{item.batch_number || "—"}</span></span>
                                    )}
                                    <span>Qty: <span className="font-medium text-slate-700">{item.quantity}</span></span>
                                    <span>₹{Number(item.price || 0).toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {invoiceItems && invoiceItems.length === 0 && (
                    <div className="text-center py-4 text-sm text-slate-500">
                      No items found in this invoice
                    </div>
                  )}

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={returnForm.quantity}
                      onChange={(e) => {
                        const qty = Math.max(1, parseInt(e.target.value) || 1);
                        const selectedPrice = selectedItemIndex !== null && invoiceItems?.[selectedItemIndex]
                          ? (invoiceItems[selectedItemIndex].price || 0)
                          : 0;
                        setReturnForm((p) => ({ ...p, quantity: qty, refund_amount: qty * selectedPrice }));
                      }}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Refund Amount */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Refund Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 inset-y-0 flex items-center text-slate-400 text-sm font-medium pointer-events-none">₹</span>
                      <input
                        type="number"
                        min="0"
                        value={returnForm.refund_amount}
                        onChange={(e) => setReturnForm((p) => ({ ...p, refund_amount: Math.max(0, parseFloat(e.target.value) || 0) }))}
                        placeholder="0.00"
                        className="w-full pl-8 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Reason (Optional)</label>
                    <input
                      type="text"
                      value={returnForm.reason}
                      onChange={(e) => setReturnForm((p) => ({ ...p, reason: e.target.value }))}
                      placeholder="e.g. Damaged, expired, wrong item"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleReturnSubmit}
                    disabled={returnSaving || !returnForm.product_uuid}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {returnSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <HugeiconsIcon icon={UndoIcon} className="text-lg"  />
                        Process Return
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>,
    document.body
  );
}
