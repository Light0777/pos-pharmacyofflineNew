import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { getPurchases } from "../../renderer/services/purchaseApi";
import { getProducts, getLowStockProducts } from "../../renderer/services/productApi";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";


export default function PurchasePage() {
  const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [pageR, setPageR] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [batchModalPurchase, setBatchModalPurchase] = useState<any>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    loadData();
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const data = await getPurchases();
      setPurchases(Array.isArray(data) ? data : []);
    } catch {
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  };

  const filteredPurchases = purchaseSearch
    ? purchases.filter((p: any) =>
        (p.supplier?.name || "").toLowerCase().includes(purchaseSearch.toLowerCase()) ||
        (p.invoice_number || "").toLowerCase().includes(purchaseSearch.toLowerCase())
      )
    : purchases;
  const totalPages = Math.ceil(filteredPurchases.length / pageSize);
  const paginatedPurchases = filteredPurchases.slice((pageR - 1) * pageSize, pageR * pageSize);

  const loadData = async () => {
    try {
      setError(null);
      const [p, low] = await Promise.all([getProducts(1, 5000), getLowStockProducts(20)]);
      setProducts(p.products);
      setLowStockProducts(Array.isArray(low) ? low : []);
    } catch (e) {
      console.error("Load error:", e);
      setError(t('purchase.loadError'));
    }
  };

  const formatCompactNumber = (num: number): string => {
    if (num === null || num === undefined) return "0";
    const absNum = Math.abs(num);
    if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
    if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
    if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
    return num.toString();
  };

  // Dashboard stats
  const totalProducts = products.length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;
  const lowStockCount = lowStockProducts.length;
  const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

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

  const Spinner = ({ size = "sm" }: { size?: "sm" | "lg" }) => (
    <div className={`animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 ${size === "sm" ? "w-4 h-4" : "w-8 h-8"}`} />
  );



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

      {/* Success/Error Messages */}
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



      {/* Recent Purchases */}
      <div>
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-xl font-bold text-slate-800 shrink-0">{t('purchase.recentPurchases')}</h3>
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t('purchase.searchPurchases')}
              value={purchaseSearch}
              onChange={(e) => { setPurchaseSearch(e.target.value); setPageR(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {purchasesLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />
              {t('common.loading')}
            </div>
          ) : paginatedPurchases.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">{t('purchaseHistory.noPurchases')}</div>
          ) : (
            <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.tableSupplier')}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.tableDate')}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.timeLabel')}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Medicine</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Quantity</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Batches</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.tableTotalAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPurchases.map((p: any) => (
                  <tr key={p.purchase_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-center font-medium text-gray-800">{p.supplier?.name || t('purchaseHistory.unknownSupplier')}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500">{format(new Date(p.created_at), 'dd MMM yyyy')}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500">{format(new Date(p.created_at), 'h:mm a')}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500">{p.items ? [...new Set(p.items.map((i: any) => i.product?.name).filter(Boolean))].join(", ") : "-"}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500">{p.items ? p.items.reduce((sum: number, i: any) => sum + Number(i.quantity || 0), 0) : 0}</td>
                    <td className="px-5 py-3.5 text-center text-gray-500">
                      {p.items ? (() => {
                        const batchNos = [...new Set(p.items.map((i: any) => i.batch_number).filter(Boolean))];
                        const count = batchNos.length;
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="text-xs font-medium text-slate-700">{count} batch{count !== 1 ? "es" : ""}</span>
                            <button onClick={() => setBatchModalPurchase(p)} className="text-slate-400 hover:text-slate-600 transition-colors" title="View batches">
                              <HugeiconsIcon icon={InformationCircleIcon} size={17} />
                            </button>
                          </span>
                        );
                      })() : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-center font-semibold text-emerald-600">₹{Number(p.total || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
              <p className="text-xs text-slate-500">
                {t('purchaseHistory.showing', { start: (pageR - 1) * pageSize + 1, end: Math.min(pageR * pageSize, filteredPurchases.length), total: filteredPurchases.length })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPageR(p => Math.max(1, p - 1))}
                  disabled={pageR === 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('purchaseHistory.prev')}
                </button>
                {(() => {
                  const pages: (number | string)[] = [];
                  const range = 2;
                  for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= pageR - range && i <= pageR + range)) {
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
                        onClick={() => setPageR(p as number)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                          p === pageR
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
                  onClick={() => setPageR(p => Math.min(totalPages, p + 1))}
                  disabled={pageR === totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('purchaseHistory.next')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Batch Info Modal */}
      {batchModalPurchase && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40" onClick={() => setBatchModalPurchase(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Purchase Batches</h3>
              <button onClick={() => setBatchModalPurchase(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left pb-2 text-xs font-medium text-gray-500">Product</th>
                    <th className="text-left pb-2 text-xs font-medium text-gray-500">Batch No</th>
                    <th className="text-center pb-2 text-xs font-medium text-gray-500">Qty</th>
                    <th className="text-right pb-2 text-xs font-medium text-gray-500">Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {batchModalPurchase.items?.map((item: any, idx: number) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 pr-4 text-gray-800 font-medium">{item.product?.name || "-"}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{item.batch_number || "-"}</td>
                      <td className="py-2.5 text-center text-gray-700">{item.quantity || 0}</td>
                      <td className="py-2.5 text-right text-gray-500">{item.expiry_date ? format(new Date(item.expiry_date + "T00:00:00"), "dd MMM yyyy") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-right text-xs text-gray-400">
              {batchModalPurchase.supplier?.name} · {batchModalPurchase.items?.length || 0} item{(batchModalPurchase.items?.length || 0) !== 1 ? "s" : ""}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}


