import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getStock, updateStock } from "../../renderer/services/stockApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  Alert01Icon,
  CancelCircleIcon,
  Cancel01Icon,
  CubeIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

// shadcn/ui components
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────
interface StockItem {
  product_uuid: string;
  name: string;
  stock: number;
  sku?: string;
  unit?: string;
}

export default function Stock() {
  const { t } = useTranslation();
  const [items, setItems] = useState<StockItem[]>([]);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [newStock, setNewStock] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "low" | "ok" | "out">("all");
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Dashboard stats
  const totalProducts = items.length;
  const lowStockCount = items.filter((item) => item.stock < 10 && item.stock > 0).length;
  const outOfStockCount = items.filter((item) => item.stock === 0).length;
  const totalStock = items.reduce((sum, item) => sum + (item.stock || 0), 0);

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
      stock: gen(totalStock),
      low: gen(lowStockCount),
      out: gen(outOfStockCount),
    };
  }, [totalProducts, totalStock, lowStockCount, outOfStockCount]);

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

  const formatCompactNumber = (num: number): string => {
    if (num === null || num === undefined) return "0";
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
    if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
    if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
    return num.toString();
  };

  // Load stock data
  const loadStock = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStock();
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error("Stock load error:", err);
      setError(err.message || t('stock.loadError'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
    const handler = () => loadStock();
    window.addEventListener('stock-updated', handler);
    return () => window.removeEventListener('stock-updated', handler);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterStatus]);

  const handleUpdate = async () => {
    if (!editingItem) return;
    try {
      setLoading(true);
      setError(null);
      await updateStock(editingItem.product_uuid, newStock);
      setModalOpen(false);
      setEditingItem(null);
      setNewStock(0);
      await loadStock();
    } catch (err: any) {
      console.error("Stock update error:", err);
      setError(err.message || t('stock.updateError'));
    } finally {
      setLoading(false);
    }
  };

  // Filtered items
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" ? true :
        filterStatus === "low" ? (item.stock < 10 && item.stock > 0) :
          filterStatus === "out" ? item.stock === 0 :
            item.stock >= 10;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredItems.length / pageSize);
  const paginatedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);



  // Helper to get status badge
  const getStatusBadge = (stock: number) => {
    if (stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
          <HugeiconsIcon icon={CancelCircleIcon} className="text-xs"  />
          {t('stock.outOfStockLabel')}
        </span>
      );
    }
    if (stock < 10) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
          <HugeiconsIcon icon={Alert01Icon} className="text-xs"  />
          {t('stock.lowStockLabel')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
        <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-xs"  />
        {t('stock.inStockLabel')}
      </span>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('stock.title')}</h1>
          <Button onClick={loadStock} className="gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {t('stock.retry')}
          </Button>
        </div>
        <div className="border border-red-200 bg-red-50 rounded-xl p-8 text-center">
          <HugeiconsIcon icon={Alert01Icon} className="text-5xl text-red-500 mx-auto mb-4"  />
          <p className="text-red-700 font-medium">{error}</p>
          <p className="text-red-600 text-sm mt-2">{t('stock.checkConnection')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('products')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('stock.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('stock.totalProducts')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{formatCompactNumber(totalProducts)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('stock.inMasterDatabase')}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('stock')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('stock.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('stock.totalStock')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{formatCompactNumber(totalStock)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('stock.unitsAcrossBatches')}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('low')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('stock.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('stock.lowStock')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{formatCompactNumber(lowStockCount)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('stock.belowThreshold')}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('out')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('stock.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('stock.outOfStock')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{formatCompactNumber(outOfStockCount)}</p>
            <p className="text-xs text-gray-500 mt-1">{t('stock.needsRestock')}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input
            placeholder={t('stock.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-10 py-2.5 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="text-lg"  />
            </button>
          )}
        </div>

        <Select value={filterStatus} onValueChange={(val: any) => setFilterStatus(val)}>
          <SelectTrigger className="max-w-[180px] bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-400">
            <SelectValue placeholder={t('stock.filterByStatus')} />
          </SelectTrigger>
          <SelectContent
            className="bg-white border-slate-200 rounded-xl overflow-hidden mt-1 font-medium"
            style={{ width: 'var(--radix-select-trigger-width)' }}
          >
            <SelectItem value="all" className="px-4 py-2.5 text-slate-700 focus:bg-slate-50 cursor-pointer">
              {t('stock.filterAll')}
            </SelectItem>
            <SelectItem value="low" className="px-4 py-2.5 text-amber-700 focus:bg-amber-50 cursor-pointer">
              {t('stock.lowStock')}
            </SelectItem>
            <SelectItem value="ok" className="px-4 py-2.5 text-emerald-700 focus:bg-emerald-50 cursor-pointer">
              {t('stock.filterInStock')}
            </SelectItem>
            <SelectItem value="out" className="px-4 py-2.5 text-red-700 focus:bg-red-50 cursor-pointer">
              {t('stock.outOfStock')}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button onClick={loadStock} disabled={loading} variant="outline" className="gap-2 shrink-0">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('stock.refresh')}
        </Button>
      </div>

      {/* Stock Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('stock.tableProduct')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('stock.tableCurrentStock')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('stock.tableStatus')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('stock.tableActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    <p className="text-slate-500 text-sm">{t('stock.loadingData')}</p>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-slate-500">
                  {searchTerm ? t('stock.noSearchResults') : t('stock.noData')}
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const stock = item.stock;
                const isLow = stock < 10 && stock > 0;
                const isOut = stock === 0;

                return (
                  <tr key={item.product_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-center">
                      <div className="font-medium text-gray-800">{item.name}</div>
                      {item.sku && (
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{t('stock.skuLabel')}: {item.sku}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-lg font-bold ${isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-600"}`}>
                        {stock}
                      </span>
                      {item.unit && <span className="text-xs text-slate-400 ml-1">{item.unit}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex justify-center">{getStatusBadge(stock)}</div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setNewStock(item.stock);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        </svg>
{t('stock.edit')}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              {t('stock.showing', { start: (page - 1) * pageSize + 1, end: Math.min(page * pageSize, filteredItems.length), total: filteredItems.length })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
{t('stock.prev')}
                </button>
              {(() => {
                const pages: (number | string)[] = [];
                const range = 2;
                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
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
                      onClick={() => setPage(p as number)}
                      className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                        p === page
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
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
{t('stock.next')}
                </button>
            </div>
          </div>
        )}
      </div>

      {/* {t('stock.lowStock')} Alert Footer */}
      {lowStockCount > 0 && (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <HugeiconsIcon icon={Alert01Icon} className="text-amber-600 text-xl"  />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">{t('stock.lowStockAlert')}</p>
              <p className="text-xs text-amber-700">
                {t('stock.lowStockMessage', { count: lowStockCount })}
              </p>
            </div>
          </div>
          <Button
            onClick={() => setFilterStatus("low")}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {t('stock.viewLowStock')}
          </Button>
        </div>
      )}

      {/* Edit Stock Modal */}
      {modalOpen && editingItem && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">{t('stock.updateTitle')}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{t('stock.productDetails')}</p>
                <p className="text-base font-semibold text-slate-800">{editingItem.name}</p>
                {editingItem.sku && (
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    {t('stock.skuLabel')}: {editingItem.sku}
                  </p>
                )}
              </div>

              {/* Current Stock (highlighted) */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 text-center">{t('stock.currentStockLabel')}</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-3xl font-bold text-slate-900">{editingItem.stock}</span>
                  {editingItem.unit && (
                    <span className="text-sm text-slate-500 font-medium">{editingItem.unit}</span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{t('stock.newStockQuantity')}</label>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg border-slate-200 hover:bg-slate-50"
                    onClick={() => setNewStock(prev => Math.max(0, prev - 1))}
                    disabled={newStock <= 0}
                  >
                    <span className="text-lg font-bold">−</span>
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(Math.max(0, Number(e.target.value)))}
                    className="w-full text-center text-lg font-semibold bg-white border-slate-300 text-slate-900 focus-visible:ring-2 focus-visible:ring-green-500/20 focus-visible:border-green-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    autoFocus
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-lg border-slate-200 hover:bg-slate-50"
                    onClick={() => setNewStock(prev => prev + 1)}
                  >
                    <span className="text-lg font-bold">+</span>
                  </Button>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => setModalOpen(false)}
                  variant="outline"
                  className="flex-1"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={handleUpdate}
                  disabled={loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <>
                      {/* <HugeiconsIcon icon={SaveIcon} className="text-lg mr-2"  /> */}
                      {t('stock.saveChanges')}
                    </>
                  )}
                </Button>
              </div>
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
                  <p className="text-base" style={{ color: "#888888" }}>{t('stock.totalProducts')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{totalProducts.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    {t('stock.masterDatabase')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.products} width={400} height={180} color="#3b82f6" />
                </div>
              </>
            )}

            {selectedStat === 'stock' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('stock.totalStock')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{totalStock.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8b5cf6", color: "#fff" }}>
                    {t('stock.unitsAcrossBatchesTitle')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.stock} width={400} height={180} color="#8b5cf6" />
                </div>
              </>
            )}

            {selectedStat === 'low' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('stock.lowStock')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{lowStockCount.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#f59e0b", color: "#fff" }}>
                    {t('stock.belowThresholdTitle')}
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
                  <p className="text-base" style={{ color: "#888888" }}>{t('stock.outOfStock')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{outOfStockCount.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#ef4444", color: "#fff" }}>
                    {t('stock.needsRestockTitle')}
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

    </div>
  );
}
