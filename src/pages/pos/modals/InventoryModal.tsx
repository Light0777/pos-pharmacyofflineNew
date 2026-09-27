import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, CancelCircleIcon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import {
  searchProducts,
  getProducts,
  getProductBatches,
} from "../../../renderer/services/productApi";

interface InventoryModalProps {
  onClose: () => void;
}

const RESULT_LIMIT = 15;
const PAGE_SIZE = 10;

export default function InventoryModal({ onClose }: InventoryModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // Browse mode (empty search): paginated full catalog, independent of the
  // main screen's product list so paging here never disturbs billing.
  const [page, setPage] = useState(1);
  const [pageItems, setPageItems] = useState<any[]>([]);
  const [pageTotal, setPageTotal] = useState(0);
  const [pageLoading, setPageLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [batches, setBatches] = useState<Record<string, any[]>>({});
  const [batchesLoading, setBatchesLoading] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus the search box on open.
  useEffect(() => {
    const t = setTimeout(() => searchRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Escape closes without touching the bill.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Debounced server search (top matches only — this is a lookup, not a list).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setHighlight(0);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchProducts(q, RESULT_LIMIT);
        if (!cancelled) {
          setResults(Array.isArray(res) ? res : []);
          setHighlight(0);
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const isSearching = query.trim().length >= 1;
  const visible = isSearching ? results : pageItems;
  const totalPages = Math.max(1, Math.ceil(pageTotal / PAGE_SIZE));

  // Browse mode: fetch the current catalog page (refreshed whenever the
  // search box is cleared, so stock shown is never stale).
  useEffect(() => {
    if (isSearching) return;
    let cancelled = false;
    setPageLoading(true);
    getProducts(page, PAGE_SIZE)
      .then((res: any) => {
        if (cancelled) return;
        setPageItems(res?.products || []);
        setPageTotal(res?.total || 0);
        setHighlight(0);
        setExpanded(null);
      })
      .catch(() => {
        if (!cancelled) {
          setPageItems([]);
          setPageTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, isSearching]);

  const toggleBatches = async (p: any) => {
    const id = p.product_uuid;
    if (expanded === id) {
      setExpanded(null);
      return;
    }
    setExpanded(id);
    if (batches[id] || batchesLoading[id]) return;
    setBatchesLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const list = await getProductBatches(id);
      setBatches((prev) => ({ ...prev, [id]: Array.isArray(list) ? list : [] }));
    } catch {
      setBatches((prev) => ({ ...prev, [id]: [] }));
    } finally {
      setBatchesLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Reuse the grid quick-add (base unit, qty 1, earliest batch), then close.
  const addToBill = (p: any) => {
    window.dispatchEvent(
      new CustomEvent("pos-add-product", { detail: { product: p, fromGrid: true } })
    );
    onClose();
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" && visible.length > 0) {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, visible.length - 1));
    } else if (e.key === "ArrowUp" && visible.length > 0) {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && visible.length > 0) {
      e.preventDefault();
      addToBill(visible[Math.min(highlight, visible.length - 1)]);
    }
  };

  const stockTone = (stock: number) =>
    stock <= 0
      ? "text-red-500"
      : stock < 10
        ? "text-amber-600"
        : "text-green-600";

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-800">Inventory</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isSearching
                ? visible.length > 0
                  ? `Top ${visible.length} match${visible.length !== 1 ? "es" : ""} — Enter adds to bill`
                  : "No matches — keep typing"
                : `${pageTotal} product${pageTotal !== 1 ? "s" : ""} — Enter adds to bill`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="relative">
            <div className="absolute left-3 inset-y-0 flex items-center text-slate-400 pointer-events-none">
              <HugeiconsIcon icon={Search01Icon} className="text-base" />
            </div>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={t("pos.searchProducts")}
              autoComplete="off"
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-none bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                className="absolute right-2.5 inset-y-0 flex items-center text-gray-400 hover:text-gray-700"
              >
                <HugeiconsIcon icon={CancelCircleIcon} className="text-base" />
              </button>
            )}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {searching || (!isSearching && pageLoading) ? (
            <div className="px-5 py-6 text-center text-gray-500 text-sm">
              {isSearching ? "Searching…" : "Loading products…"}
            </div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-6 text-center text-gray-500 text-sm">
              {isSearching ? t("pos.noProductsFound") : "No products yet."}
            </div>
          ) : (
            visible.map((p, i) => {
              const stock = p.stock ?? 0;
              const isOpen = expanded === p.product_uuid;
              const list = batches[p.product_uuid] || [];
              const loading = !!batchesLoading[p.product_uuid];
              return (
                <div
                  key={p.product_uuid}
                  className={`border-b border-gray-100 last:border-b-0 ${i === highlight ? "bg-blue-50" : ""}`}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <div
                    className="flex items-center gap-2 px-4 py-2 cursor-pointer"
                    onClick={() => toggleBatches(p)}
                  >
                    <span className="text-gray-400 text-xs w-3 shrink-0">{isOpen ? "▾" : "▸"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 text-sm truncate">
                        {p.name}
                        {p.manufacturer && (
                          <span className="ml-1.5 font-normal text-gray-500">{p.manufacturer}</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {[p.sku, p.barcode].filter(Boolean).join(" • ") || "—"}
                        {p.price != null ? ` • ₹${p.price}` : ""}
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${stockTone(stock)}`}>
                      {stock}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addToBill(p);
                      }}
                      className="shrink-0 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-500 hover:bg-green-50 rounded-none transition-colors"
                    >
                      + Add
                    </button>
                  </div>
                  {isOpen && (
                    <div className="px-4 pb-2.5 pl-8">
                      {loading ? (
                        <div className="text-xs text-gray-400">Loading batches…</div>
                      ) : list.length === 0 ? (
                        <div className="text-xs text-gray-400">No batch records.</div>
                      ) : (
                        <div className="border border-gray-200 rounded-none overflow-hidden">
                          {list.map((b: any) => {
                            const expired = b.expiry_date
                              ? new Date(b.expiry_date) <= new Date()
                              : false;
                            return (
                              <div
                                key={b.batch_uuid}
                                className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-gray-100 last:border-b-0 bg-gray-50"
                              >
                                <span className="font-semibold text-gray-800 truncate">
                                  {b.batch_number}
                                </span>
                                <span className="text-gray-500 whitespace-nowrap">
                                  Qty {b.quantity ?? 0}
                                </span>
                                <span
                                  className={`whitespace-nowrap ${expired ? "text-red-500 font-semibold" : "text-gray-500"}`}
                                >
                                  {b.expiry_date
                                    ? new Date(b.expiry_date).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "2-digit",
                                      })
                                    : "—"}
                                  {expired ? " • Expired" : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination (browse mode only) */}
        {!isSearching && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-2.5 border-t border-slate-100 bg-gray-50">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-300 bg-white hover:border-gray-400 rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ‹ Prev
            </button>
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-300 bg-white hover:border-gray-400 rounded-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next ›
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
