import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getPurchases } from "../../renderer/services/purchaseApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ShoppingCart01Icon,
  Cancel01Icon,
  File01Icon,
  Alert01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";



export default function PurchaseHistory() {
  const { t } = useTranslation();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getPurchases();
      
      let purchasesData = [];
      if (Array.isArray(response)) purchasesData = response;
      else if (response.data && Array.isArray(response.data)) purchasesData = response.data;
      else if (response.success && response.data && Array.isArray(response.data)) purchasesData = response.data;
      else if (response.purchases && Array.isArray(response.purchases)) purchasesData = response.purchases;
      else purchasesData = [];
      
      setPurchases(purchasesData);
    } catch (e) {
      console.error("Error loading purchases:", e);
      setError(t('purchaseHistory.loadError'));
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = purchases.filter((p) =>
    [p.supplier?.name, p.supplier_name, p.purchase_uuid, p.id?.toString()]
      .some((f) => f?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalPurchases = purchases.length;
  const totalSpent = purchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
  const averagePurchase = totalPurchases > 0 ? totalSpent / totalPurchases : 0;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  const formatNumber = (value: any) => {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

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
      purchases: gen(totalPurchases),
      spent: gen(totalSpent),
      avg: gen(averagePurchase),
    };
  }, [totalPurchases, totalSpent, averagePurchase]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-red-700">
              <HugeiconsIcon icon={Alert01Icon} className="text-xl"  />
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <HugeiconsIcon icon={Cancel01Icon} className="text-lg"  />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('purchases')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('purchaseHistory.totalPurchases')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{totalPurchases}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('spent')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('purchaseHistory.totalSpent')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">₹{formatNumber(totalSpent).toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('avg')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('purchaseHistory.averagePurchase')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">₹{formatNumber(averagePurchase).toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative flex-1">
        <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"  />
        <Input
          placeholder="Search by supplier, invoice..."
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

      {/* Purchases Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="table-scroll"><table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-start px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.tableSupplier')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.tableItems')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.tableTotalAmount')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.tableDate')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-500">
                    <HugeiconsIcon icon={ShoppingCart01Icon} className="text-6xl text-slate-300 mb-2"  />
                    <p className="text-lg">{searchTerm ? `No results found for "${searchTerm}"` : t('purchaseHistory.noPurchases')}</p>
                    <p className="text-sm">{searchTerm ? "Try a different search term" : t('purchaseHistory.noPurchasesSubtext')}</p>
                  </td>
                </tr>
              ) : (
                pageItems.map((purchase) => (
                  <tr
                    key={purchase.purchase_uuid || purchase.id}
                    onClick={() => setSelected(purchase)}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {purchase.supplier?.name?.charAt(0).toUpperCase() || 
                           purchase.supplier_name?.charAt(0).toUpperCase() || 
                           "W"}
                        </div>
                        <div className="min-w-0 text-start">
                          <div className="font-medium text-slate-800 truncate">
                            {purchase.supplier?.name || purchase.supplier_name || t('purchaseHistory.walkInSupplier')}
                          </div>
                          {purchase.supplier?.phone && (
                            <div className="text-xs text-slate-400 truncate">{purchase.supplier.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="font-medium text-slate-800">
                        {t('purchaseHistory.itemsCount', { count: purchase.items?.length || 0 })}
                      </div>
                      {purchase.items && purchase.items.length > 0 && (
                        <div className="text-xs text-slate-400 truncate max-w-[160px] mx-auto mt-0.5">
                          {purchase.items.slice(0, 2).map((item: any) => 
                            item.product?.name || item.name
                          ).join(", ")}
                          {purchase.items.length > 2 && "..."}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center font-semibold text-emerald-600">
                      ₹{formatNumber(purchase.total).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-center text-slate-500">
                      <div>{purchase.created_at ? new Date(purchase.created_at).toLocaleDateString() : 'N/A'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {purchase.created_at ? new Date(purchase.created_at).toLocaleTimeString() : 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-5">
          <button
            onClick={() => setPage(safePage - 1)}
            disabled={safePage <= 1}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >‹</button>
          {(() => {
            const pages: (number | string)[] = [];
            for (let i = 1; i <= totalPages; i++) {
              if (i === 1 || i === totalPages || Math.abs(i - safePage) <= 1) {
                pages.push(i);
              } else if (Math.abs(i - safePage) === 2) {
                if (pages[pages.length - 1] !== '…') pages.push('…');
              }
            }
            return pages.map((p, i) =>
              typeof p === 'number' ? (
                <button
                  key={i}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    p === safePage
                      ? 'border border-gray-300 bg-white font-medium text-gray-800'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >{String(p).padStart(2, '0')}</button>
              ) : (
                <span key={i} className="text-gray-400 text-sm px-1">…</span>
              )
            );
          })()}
          <button
            onClick={() => setPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >›</button>
        </div>
      )}

      {/* Purchase Details Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-800">{t('purchaseHistory.purchaseDetails')}</h2>
                </div>
                <p className="text-slate-400 text-sm mt-1 text-left">
                  {t('purchaseHistory.orderNumber')} #{selected.purchase_uuid?.slice(0, 8).toUpperCase() || 'N/A'}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex gap-4">
                {/* Supplier Info */}
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-slate-700">{t('purchaseHistory.supplierInformation')}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-start gap-2">
                      <span className="text-slate-500">{t('purchaseHistory.nameLabel')}:</span>
                      <span className="font-medium text-slate-700">
                        {selected.supplier?.name || selected.supplier_name || t('purchaseHistory.walkInSupplier')}
                      </span>
                    </div>
                    {selected.supplier?.phone && (
                      <div className="flex justify-start gap-2">
                        <span className="text-slate-500">{t('purchaseHistory.phoneLabel')}:</span>
                        <span className="text-slate-700">{selected.supplier.phone}</span>
                      </div>
                    )}
                    {selected.supplier?.email && (
                      <div className="flex justify-start gap-2">
                        <span className="text-slate-500">{t('purchaseHistory.emailLabel')}:</span>
                        <span className="text-slate-700">{selected.supplier.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Purchase Info */}
                <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-slate-700">{t('purchaseHistory.purchaseInformation')}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-start gap-2">
                      <span className="text-slate-500">{t('purchaseHistory.dateLabel')}:</span>
                      <span className="text-slate-700">
                        {selected.created_at ? new Date(selected.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-start gap-2">
                      <span className="text-slate-500">{t('purchaseHistory.timeLabel')}:</span>
                      <span className="text-slate-700">
                        {selected.created_at ? new Date(selected.created_at).toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-start gap-2">
                      <span className="text-slate-500">{t('purchaseHistory.itemsLabel')}:</span>
                      <span className="text-slate-700">{t('purchaseHistory.productsCount', { count: selected.items?.length || 0 })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-slate-700">{t('purchaseHistory.itemsPurchased')}</h3>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="table-scroll"><table className="w-full text-sm table-fixed">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.productLabel')}</th>
                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.quantityLabel')}</th>
                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('purchaseHistory.costPriceLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.items && selected.items.length > 0 ? (
                        selected.items.map((item: any, i: number) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-3.5 text-slate-700 font-medium">{item.product?.name || item.name || t('purchaseHistory.unknownProduct')}</td>
                            <td className="px-5 py-3.5 text-center text-slate-500">x{item.quantity || 0}</td>
                            <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">₹{formatNumber(item.cost_price).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="text-center text-slate-400 py-8">{t('purchaseHistory.noItemDetails')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-slate-600">{t('purchaseHistory.totalAmountLabel')}</p>
                    <p className="text-xs text-slate-500">{t('purchaseHistory.includingAllItems')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-emerald-700">₹{formatNumber(selected.total).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <Button onClick={() => setSelected(null)} className="w-full bg-green-600 hover:bg-green-700 text-white">
                {t('common.close')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedStat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStat(null)}>
          <div className="w-[min(90vw,400px)] h-[min(80vh,500px)] rounded-[24px] overflow-hidden pt-5 px-5 pb-3 flex flex-col" style={{ background: "#1a1d1f" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSelectedStat(null)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#dc2626", color: "#fff" }}>
                Close
              </button>
            </div>

            {selectedStat === 'purchases' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Total Purchases</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{totalPurchases.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    All Purchases
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.purchases} width={400} height={180} color="#3b82f6" />
                </div>
              </>
            )}

            {selectedStat === 'spent' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Total Spent</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">₹{Math.round(totalSpent).toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#10b981", color: "#fff" }}>
                    Total Amount
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.spent} width={400} height={180} color="#10b981" />
                </div>
              </>
            )}

            {selectedStat === 'avg' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Average Purchase</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">₹{Math.round(averagePurchase).toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8b5cf6", color: "#fff" }}>
                    Per Transaction
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.avg} width={400} height={180} color="#8b5cf6" />
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
