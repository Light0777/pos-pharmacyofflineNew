import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getTopProducts,
  getStockReport,
  getProfitReport,
  getDashboardReport,
  getSalesTrend,
  getProfitTrend,
  getSalesByPayment,
  getCustomerPurchaseReport,
  getCustomerTrend,
} from "../../renderer/services/reportApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  CancelCircleIcon,
} from "@hugeicons/core-free-icons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

// shadcn/ui components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";

// ── formatCompactNumber
const formatCompactNumber = (num: number): string => {
  if (num === null || num === undefined) return "0";
  const absNum = Math.abs(num);
  if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
  if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
  if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
  return num.toFixed(2);
};

export default function Reports() {
  const { t } = useTranslation();
  const [top, setTop] = useState<any[]>([]);
  const [stock, setStock] = useState<any[]>([]);
  const [profit, setProfit] = useState<any>({
    revenue: 0,
    refunds: 0,
    cost: 0,
    profit: 0,
  });
  const [dashboard, setDashboard] = useState<any>({
    today_sales: 0,
    month_sales: 0,
    total_sales: 0,
    total_orders: 0,
    low_stock: [],
    recent_sales: [],
    recent_purchases: [],
    top_products: [],
  });
  const [salesTrend, setSalesTrend] = useState<any[]>([]);
  const [profitTrend, setProfitTrend] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [customerReport, setCustomerReport] = useState<any[]>([]);
  const [customerTrend, setCustomerTrend] = useState<Array<{ date: string; total: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendDays, setTrendDays] = useState(7);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [hoveredPaymentIdx, setHoveredPaymentIdx] = useState<number | null>(null);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const loadReports = async () => {
    try {
      setError(null);


      const [
        dashboardRes,
        topRes,
        stockRes,
        profitRes,
        salesTrendRes,
        profitTrendRes,
        paymentRes,
        customerRes,
        customerTrendRes,
      ] = await Promise.allSettled([
        getDashboardReport(),
        getTopProducts(),
        getStockReport(),
        getProfitReport(),
        getSalesTrend(trendDays),
        getProfitTrend(trendDays),
        getSalesByPayment(),
        getCustomerPurchaseReport(),
        getCustomerTrend(),
      ]);

      if (dashboardRes.status === "fulfilled") setDashboard(dashboardRes.value);
      if (topRes.status === "fulfilled" && Array.isArray(topRes.value)) setTop(topRes.value);
      else setTop([]);
      if (stockRes.status === "fulfilled" && Array.isArray(stockRes.value)) setStock(stockRes.value);
      else setStock([]);
      if (profitRes.status === "fulfilled" && profitRes.value) setProfit(profitRes.value);
      if (salesTrendRes.status === "fulfilled" && Array.isArray(salesTrendRes.value)) setSalesTrend(salesTrendRes.value);
      if (profitTrendRes.status === "fulfilled" && Array.isArray(profitTrendRes.value)) setProfitTrend(profitTrendRes.value);
      if (paymentRes.status === "fulfilled" && Array.isArray(paymentRes.value)) setPaymentMethods(paymentRes.value);
      if (customerRes.status === "fulfilled" && Array.isArray(customerRes.value)) setCustomerReport(customerRes.value);
      if (customerTrendRes.status === "fulfilled" && Array.isArray(customerTrendRes.value)) setCustomerTrend(customerTrendRes.value);
    } catch (err) {
      console.error("Reports error:", err);
      setError(t('reports.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [trendDays]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const profitMargin = profit.revenue > 0 ? (profit.profit / profit.revenue) * 100 : 0;


  const revenueDelta = (() => {
    if (profitTrend.length < 2) return null;
    const vals = profitTrend.map((d: any) => Number(d.revenue || 0));
    const mid = Math.floor(vals.length / 2);
    const prevSum = vals.slice(0, mid).reduce((a: number, b: number) => a + b, 0);
    const currSum = vals.slice(mid).reduce((a: number, b: number) => a + b, 0);
    if (prevSum === 0) return { pct: 0, up: true };
    const pct = ((currSum - prevSum) / prevSum) * 100;
    return { pct: Math.round(pct * 100) / 100, up: pct >= 0 };
  })();

  const costDelta = (() => {
    if (profitTrend.length < 2) return null;
    const vals = profitTrend.map((d: any) => Number(d.cost || 0));
    const mid = Math.floor(vals.length / 2);
    const prevSum = vals.slice(0, mid).reduce((a: number, b: number) => a + b, 0);
    const currSum = vals.slice(mid).reduce((a: number, b: number) => a + b, 0);
    if (prevSum === 0) return { pct: 0, up: true };
    const pct = ((currSum - prevSum) / prevSum) * 100;
    return { pct: Math.round(pct * 100) / 100, up: pct >= 0 };
  })();

  const profitDelta = (() => {
    if (profitTrend.length < 2) return null;
    const vals = profitTrend.map((d: any) => Number(d.profit || 0));
    const mid = Math.floor(vals.length / 2);
    const prevSum = vals.slice(0, mid).reduce((a: number, b: number) => a + b, 0);
    const currSum = vals.slice(mid).reduce((a: number, b: number) => a + b, 0);
    if (prevSum === 0) return { pct: 0, up: true };
    const pct = ((currSum - prevSum) / prevSum) * 100;
    return { pct: Math.round(pct * 100) / 100, up: pct >= 0 };
  })();

  const profitMarginDelta = (() => {
    if (profitTrend.length < 2) return null;
    const margins = profitTrend.map((d: any) => {
      const rev = Number(d.revenue || 0);
      const cost = Number(d.cost || 0);
      return rev > 0 ? ((rev - cost) / rev) * 100 : 0;
    });
    const mid = Math.floor(margins.length / 2);
    const prevAvg = margins.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
    const currAvg = margins.slice(mid).reduce((a, b) => a + b, 0) / (margins.length - mid);
    if (prevAvg === 0) return { pct: 0, up: true };
    const pct = ((currAvg - prevAvg) / prevAvg) * 100;
    return { pct: Math.round(pct * 100) / 100, up: pct >= 0 };
  })();

  const totalCreditBalance = customerReport.reduce((sum: number, c: any) => sum + (c.credit_balance || 0), 0);
  const inventoryValue = stock.reduce((sum: number, s: any) => sum + ((s.stock || 0) * (s.price || 0)), 0);
  const gaugeTotal = totalCreditBalance + inventoryValue;
  const creditsPct = gaugeTotal > 0 ? totalCreditBalance / gaugeTotal : 0.5;
  const invPct = gaugeTotal > 0 ? inventoryValue / gaugeTotal : 0.5;

  const Sparkline = ({ data: chartData, dataKey, width = 400, height = 280, color = "#22c55e" }: { data: any[], dataKey: string, width?: number, height?: number, color?: string }) => {
    const [hovered, setHovered] = useState(false);
    if (!chartData || chartData.length === 0) return null;
    const values = chartData.map((d: any) => Number(d[dataKey]) || 0);
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
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}>
        <defs>
          <linearGradient id={`sg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={hovered ? 0.55 : 0.38} />
            <stop offset="100%" stopColor={color} stopOpacity={hovered ? 0.06 : 0.02} />
          </linearGradient>
        </defs>
        <path d={`${lineD} L ${width},${height} L 0,${height} Z`} fill={`url(#sg-${dataKey})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth={hovered ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke-width 0.15s' }} />
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      {/* Error Message */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex justify-between items-center">
            <div className="flex items-center gap-2 text-red-700">
              <HugeiconsIcon icon={Alert01Icon} className="text-xl"  />
              <p className="text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <HugeiconsIcon icon={CancelCircleIcon} className="text-lg"  />
            </button>
          </CardContent>
        </Card>
      )}

      {/* ========== OVERVIEW ========== */}
      <div className="space-y-5">

          {/* Finance Stats Row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 text-start">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
              <button onClick={() => setSelectedStat('revenue')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M7 7h10v10" />
                </svg>
              </button>
              <div className="flex-shrink-0">
                <p className="text-xs text-gray-400 mb-0.5">{t('reports.statistics')}</p>
                <p className="text-sm font-semibold text-gray-700 mb-3">{t('reports.totalRevenue')}</p>
                <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(profit.revenue || 0)}</p>
                {(profit.refunds ?? 0) > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {t('reports.refunds', { amount: formatCompactNumber(profit.refunds ?? 0) })}
                  </p>
                )}
                {revenueDelta && (
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${revenueDelta.up ? 'text-green-500' : 'text-red-500'}`}>
                      {revenueDelta.up ? '+' : ''}{Math.abs(revenueDelta.pct)}%
                    </span>
                    <svg className={revenueDelta.up ? 'text-green-500' : 'text-red-500'} width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: revenueDelta.up ? 'none' : 'rotate(180deg)' }}>
                      <path d="M3 10L7 5L11 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
                  <polyline fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,60 20,50 35,65 45,20 60,55 75,45 90,58 110,35 130,50 160,42" />
                </svg>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
              <button onClick={() => setSelectedStat('cost')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M7 7h10v10" />
                </svg>
              </button>
              <div className="flex-shrink-0">
                <p className="text-xs text-gray-400 mb-0.5">{t('reports.statistics')}</p>
                <p className="text-sm font-semibold text-gray-700 mb-3">{t('reports.totalCost')}</p>
                <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(profit.cost || 0)}</p>
                {costDelta && (
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${costDelta.up ? 'text-green-500' : 'text-red-500'}`}>
                      {costDelta.up ? '+' : ''}{Math.abs(costDelta.pct)}%
                    </span>
                    <svg className={costDelta.up ? 'text-green-500' : 'text-red-500'} width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: costDelta.up ? 'none' : 'rotate(180deg)' }}>
                      <path d="M3 10L7 5L11 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
                  <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,60 20,45 35,55 45,30 60,50 75,40 90,52 110,25 130,45 160,38" />
                </svg>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
              <button onClick={() => setSelectedStat('profit')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M7 7h10v10" />
                </svg>
              </button>
              <div className="flex-shrink-0">
                <p className="text-xs text-gray-400 mb-0.5">{t('reports.statistics')}</p>
                <p className="text-sm font-semibold text-gray-700 mb-3">{t('reports.netProfit')}</p>
                <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(profit.profit || 0)}</p>
                {profitDelta && (
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${profitDelta.up ? 'text-green-500' : 'text-red-500'}`}>
                      {profitDelta.up ? '+' : ''}{Math.abs(profitDelta.pct)}%
                    </span>
                    <svg className={profitDelta.up ? 'text-green-500' : 'text-red-500'} width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: profitDelta.up ? 'none' : 'rotate(180deg)' }}>
                      <path d="M3 10L7 5L11 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
                  <polyline fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,55 20,40 35,50 45,25 60,45 75,35 90,48 110,20 130,40 160,32" />
                </svg>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
              <button onClick={() => setSelectedStat('margin')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17L17 7M7 7h10v10" />
                </svg>
              </button>
              <div className="flex-shrink-0">
                <p className="text-xs text-gray-400 mb-0.5">{t('reports.statistics')}</p>
                <p className="text-sm font-semibold text-gray-700 mb-3">{t('reports.profitMargin')}</p>
                <p className="text-5xl font-bold text-gray-900 leading-none mb-2">{profitMargin.toFixed(1)}%</p>
                {profitMarginDelta && (
                  <div className="flex items-center gap-1">
                    <span className={`text-sm font-medium ${profitMarginDelta.up ? 'text-green-500' : 'text-red-500'}`}>
                      {profitMarginDelta.up ? '+' : ''}{Math.abs(profitMarginDelta.pct)}%
                    </span>
                    <svg className={profitMarginDelta.up ? 'text-green-500' : 'text-red-500'} width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transform: profitMarginDelta.up ? 'none' : 'rotate(180deg)' }}>
                      <path d="M3 10L7 5L11 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
                  <polyline fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,50 20,35 35,45 45,20 60,40 75,30 90,42 110,15 130,35 160,28" />
                </svg>
              </div>
            </div>
          </div>

          {/* Bento: Sales Trend + Customer Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
            {salesTrend.length > 0 && (
              <Card className="shadow-sm border-slate-200 flex flex-col h-full">
                <CardHeader className="pb-1 shrink-0">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#a0aabf' }}>{t('reports.statistics')}</p>
                      <p className="text-xl font-bold mt-0.5" style={{ color: '#1e2535' }}>{t('reports.salesTrend')}</p>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowRangeMenu(!showRangeMenu)}
                        className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 text-slate-600 bg-white hover:bg-slate-50 transition-colors"
                      >
                        {trendDays === 365 ? t('reports.lastYear') : t('reports.lastDays', { days: trendDays })}
                      </button>
                      {showRangeMenu && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setShowRangeMenu(false)} />
                          <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[140px]">
                            {[7, 14, 30, 60, 90, 180, 365].map((d) => (
                              <button
                                key={d}
                                onClick={() => { setTrendDays(d); setShowRangeMenu(false); }}
                                className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors ${trendDays === d ? "text-blue-600 font-semibold" : "text-slate-700"}`}
                              >
                                {d === 365 ? t('reports.lastYear') : t('reports.lastDays', { days: d })}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  {(() => {
                    const data = salesTrend.slice(0, 7);
                    const maxVal = Math.max(...data.map((d: any) => Number(d.total || 0)), 1);
                    const activeIdx = Math.min(3, data.length - 1);
                    return (
                      <div className="chart-area relative flex flex-col flex-1" style={{ background: '#f4f5fb', borderRadius: 14, padding: '16px 12px 12px' }}>
                        <style>{`
                          @keyframes growUp { from { transform: scaleY(0); transform-origin: bottom; } to { transform: scaleY(1); transform-origin: bottom; } }
                          .bar-anim { animation: growUp 0.7s cubic-bezier(0.34,1.56,0.64,1) both; }
                          .bar-col:hover .bar-inner { opacity: 1 !important; }
                          .bar-col:hover .bar-tip { display: block !important; }
                          .bar-col:hover .bar-marker { display: block !important; }
                        `}</style>
                        <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, minHeight: 0 }}>
                          <div style={{ display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between', marginRight: 8, paddingBottom: 0 }}>
                            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                              <span key={f} style={{ fontSize: 11, color: '#9aa5bf', fontWeight: 500, lineHeight: 1, width: 28, textAlign: 'right' }}>
                                ₹{maxVal < 1000 ? Math.round(maxVal * f).toLocaleString() : (maxVal * f / 1000).toFixed(0) + 'k'}
                              </span>
                            ))}
                          </div>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10, position: 'relative' }}>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column-reverse', justifyContent: 'space-between', pointerEvents: 'none' }}>
                              {[0, 1, 2, 3, 4].map((i) => (
                                <div key={i} style={{ width: '100%', borderTop: '1px dashed #e0e3ef' }} />
                              ))}
                            </div>
                            {data.map((d: any, i: number) => {
                              const pct = (Number(d.total || 0) / maxVal) * 100;
                              const isActive = i === activeIdx;
                              return (
                                <div key={i} className="bar-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative', cursor: 'pointer' }}>
                                  <div className="bar-tip" style={{ display: isActive ? 'block' : 'none', position: 'absolute', bottom: pct + 22, left: '50%', transform: 'translateX(-60%)', background: '#fff', border: '1.5px solid #e8eaf2', borderRadius: 10, padding: '6px 12px', fontSize: 13, fontWeight: 700, color: '#1e2535', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,0.10)', zIndex: 10, pointerEvents: 'none' }}>
                                    ₹{Number(d.total || 0).toLocaleString()}
                                  </div>
                                  <div className="bar-marker" style={{ display: isActive ? 'block' : 'none', position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 2, borderLeft: '2px dashed #22c55e', height: pct, pointerEvents: 'none', zIndex: 5 }}>
                                    <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 12, height: 12, borderRadius: '50%', background: '#fff', border: '2.5px solid #22c55e', zIndex: 6 }} />
                                  </div>
                                  <div className="bar-inner bar-anim" style={{ width: '100%', borderRadius: '10px 10px 0 0', height: `${pct}%`, background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)', opacity: isActive ? 1 : 0.55, position: 'relative', overflow: 'hidden', animationDelay: `${i * 0.07}s` }}>
                                    <div style={{ position: 'absolute', top: 6, left: '10%', width: '38%', height: '45%', background: 'rgba(255,255,255,0.22)', borderRadius: '8px 8px 60% 60%', pointerEvents: 'none' }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, padding: '8px 0 0', marginLeft: 36, flexShrink: 0 }}>
                          {data.map((d: any, i: number) => (
                            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#9aa5bf', fontWeight: 500 }}>
                              {d.date || ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
            <div className="flex flex-col gap-5">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm text-slate-400 font-medium leading-none mb-1">{t('reports.customers')}</p>
                    <p className="text-3xl font-bold text-slate-800 leading-tight">{customerReport.length.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-emerald-50 rounded-xl px-3 py-1.5 mt-1">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="7" fill="#10b981"/>
                      <path d="M4.5 8.5L7 5.5L9.5 8.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700 leading-none">1.3%</p>
                      <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">{t('reports.vsLastWeek')}</p>
                    </div>
                  </div>
                </div>
                <div className="relative mt-4" style={{ height: 140 }}>
                  <ChartContainer
                    config={{
                      customers: {
                        label: t('reports.customers'),
                        color: "#22c55e",
                      },
                    }}
                    className="h-full w-full"
                  >
                  <AreaChart
                    data={customerTrend.length > 0 ? customerTrend.map((d: any) => ({ day: d.date.slice(5), val: d.total })) : []}
                    margin={{ top: 4, right: 4, left: 4, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="customerFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" hide />
                    <YAxis hide domain={[0, 'dataMax']} />
                    <Area
                      type="monotone"
                      dataKey="val"
                      stroke="#22c55e"
                      strokeWidth={2.2}
                      fill="url(#customerFill)"
                      dot={{ fill: '#22c55e', stroke: '#fff', strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 4 }}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600 }}
                      formatter={(value: any) => [value.toLocaleString(), t('reports.customers')]}
                      labelStyle={{ display: 'none' }}
                    />
                  </AreaChart>
                  </ChartContainer>
                </div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <p className="text-sm font-medium" style={{ color: '#a0aabf' }}>{t('reports.statistics')}</p>
                <p className="text-lg font-semibold mt-0.5" style={{ color: '#1e2535' }}>{t('reports.yearlyCredit')}</p>
                <hr className="my-4" style={{ border: 'none', borderTop: '1.5px solid #f0f2f7' }} />
                <div className="flex items-center justify-center mb-6" style={{ height: 200 }}>
                  <div style={{ position: 'relative', width: 200, height: 200 }}>
                    <svg width="200" height="200" viewBox="0 0 200 200">
                      {(() => {
                        const cx = 100, cy = 100, r = 80, lw = 16;
                        const gapDeg = 54;
                        const startDeg = 90 + gapDeg / 2;
                        const endDeg = 90 - gapDeg / 2 + 360;
                        const totalArcDeg = 360 - gapDeg;
                        const toRad = (d: number) => d * Math.PI / 180;
                        const startRad = toRad(startDeg);
                        const splitRad = toRad(startDeg + totalArcDeg * creditsPct);
                        const endRad = toRad(startDeg + totalArcDeg);
                        const arcPath = (cx: number, cy: number, r: number, sa: number, ea: number) => {
                          const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
                          const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
                          const large = ea - sa > Math.PI ? 1 : 0;
                          return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
                        };
                        const handleMouseMove = (e: React.MouseEvent, seg: string) => {
                          setTooltipPos({ x: e.clientX, y: e.clientY });
                          setHoveredSegment(seg);
                        };
                        const handleMouseLeave = () => {
                          setHoveredSegment(null);
                          setTooltipPos(null);
                        };
                        return (
                          <>
                            <path d={arcPath(cx, cy, r, startRad, endRad)} fill="none" stroke="#d1fae5" strokeWidth={lw} strokeLinecap="round" style={{ cursor: 'pointer' }} />
                            <path d={arcPath(cx, cy, r, startRad, endRad)} fill="none" stroke="transparent" strokeWidth={lw + 12} strokeLinecap="round" style={{ cursor: 'pointer' }} onMouseMove={(e) => handleMouseMove(e, 'inventory')} onMouseLeave={handleMouseLeave} />
                            <path d={arcPath(cx, cy, r, startRad, splitRad)} fill="none" stroke="#10b981" strokeWidth={lw} strokeLinecap="round" style={{ cursor: 'pointer' }} />
                            <path d={arcPath(cx, cy, r, startRad, splitRad)} fill="none" stroke="transparent" strokeWidth={lw + 12} strokeLinecap="round" style={{ cursor: 'pointer' }} onMouseMove={(e) => handleMouseMove(e, 'credits')} onMouseLeave={handleMouseLeave} />
                          </>
                        );
                      })()}
                    </svg>
                    <div style={{ position: 'absolute', top: '44%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 2px' }}>{t('reports.totalCredits')}</p>
                      <p style={{ fontSize: 17, fontWeight: 700, color: '#1f2937', margin: 0 }}>₹{totalCreditBalance.toLocaleString()}</p>
                    </div>
                    {hoveredSegment && tooltipPos && (
                      <div style={{
                        position: 'fixed',
                        left: tooltipPos.x + 12,
                        top: tooltipPos.y - 10,
                        background: '#1e293b',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                        pointerEvents: 'none',
                        zIndex: 9999,
                        whiteSpace: 'nowrap',
                      }}>
                        {hoveredSegment === 'credits'
                          ? t('reports.creditsTooltip', { amount: totalCreditBalance.toLocaleString(), pct: (creditsPct * 100).toFixed(0) })
                          : t('reports.inventoryTooltip', { amount: inventoryValue.toLocaleString(), pct: (invPct * 100).toFixed(0) })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm" style={{ color: '#6b7280' }}>
                  <span className="flex items-center gap-2">
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                    {t('reports.totalCredits')} <span className="font-medium ml-1" style={{ color: '#374151' }}>{(creditsPct * 100).toFixed(0)}%</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#a7f3d0', display: 'inline-block', flexShrink: 0 }} />
                    {t('reports.inventory')} <span className="font-medium ml-1" style={{ color: '#374151' }}>{(invPct * 100).toFixed(0)}%</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* ========== SALES ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          {/* Top Selling Products - 1 col */}
          <div className="md:col-span-1 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col text-left">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">{t('reports.statistics')}</p>
              <h2 className="text-lg font-bold text-gray-800">{t('reports.topSellingProducts')}</h2>
            </div>
            {top.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">{t('reports.noSalesData')}</div>
            ) : (
              <>
                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  {(() => {
                    const maxQty = Math.max(...top.map((p: any) => Number(p.total_qty || 0)), 1);
                    return top.map((p: any, idx: number) => {
                      const pct = (Number(p.total_qty || 0) / maxQty) * 100;
                      const isFirst = idx === 0;
                      return (
                        <div key={p.product_uuid || idx}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium text-gray-700 truncate block">{p.name || t('reports.unknown')}</span>
                              {p.manufacturerName && <span className="text-xs text-gray-400">{p.manufacturerName}</span>}
                            </div>
                            <span className={`text-sm font-semibold shrink-0 ml-2 ${isFirst ? 'text-green-600' : 'text-gray-400'}`}>
                              {p.total_qty || 0} {t('reports.units')}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-1000"
                              style={{
                                width: `${pct}%`,
                                background: isFirst
                                  ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                                  : '#d1d5db'
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[11px] text-gray-400 font-medium">{t('reports.zeroPct')}</span>
                  <span className="text-[11px] text-gray-400 font-medium">{t('reports.fiftyPct')}</span>
                  <span className="text-[11px] text-gray-400 font-medium">{t('reports.hundredPct')}</span>
                </div>
              </>
            )}
          </div>

          {/* Recent Purchases - 1 col */}
          {dashboard.recent_purchases?.length > 0 && (() => {
            const purchases = dashboard.recent_purchases;
            const maxTotal = Math.max(...purchases.map((p: any) => Number(p.total || 0)), 1);
            return (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200 flex flex-col text-left">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-0.5">{t('reports.statistics')}</p>
                  <h2 className="text-lg font-bold text-gray-800">{t('reports.recentPurchases')}</h2>
                </div>
                <div className="flex flex-col gap-3">
                  {purchases.map((purchase: any, idx: number) => {
                    const pct = (Number(purchase.total || 0) / maxTotal) * 100;
                    const isFirst = idx === 0;
                    return (
                      <div key={idx}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-700 truncate block">{purchase.supplier_name || t('reports.unknownSupplier')}</span>
                            <span className="text-xs text-gray-400">{new Date(purchase.created_at).toLocaleDateString()}</span>
                          </div>
                          <span className={`text-sm font-semibold shrink-0 ml-2 ${isFirst ? 'text-green-600' : 'text-gray-400'}`}>
                            ₹{Number(purchase.total || 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-1000"
                            style={{
                              width: `${pct}%`,
                              background: isFirst
                                ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
                                : '#d1d5db'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[11px] text-gray-400 font-medium">{t('reports.zero')}</span>
                  <span className="text-[11px] text-gray-400 font-medium">₹{Math.round(maxTotal / 2).toLocaleString()}</span>
                  <span className="text-[11px] text-gray-400 font-medium">₹{maxTotal.toLocaleString()}</span>
                </div>
              </div>
            );
          })()}

          {/* Payment Methods - 1 col */}
          <Card className="shadow-sm border-slate-200 flex flex-col rounded-3xl" style={{ background: '#000' }}>
            <CardContent className="p-5 flex-1 flex flex-col text-white select-none">
              {paymentMethods.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-neutral-400 text-sm">{t('reports.noPaymentData')}</div>
              ) : (
                <>
                  {/* Header */}
                  <div className="mb-4 text-left">
                    <span className="text-base font-medium tracking-tight">{t('reports.donutChart')}</span>
                  </div>

                  {/* Total Activity */}
                  {(() => {
                    const avgPct = paymentMethods.length > 0
                      ? (100 / paymentMethods.length).toFixed(0)
                      : '0';
                    return (
                      <div className="flex items-start gap-2 mb-5 text-left">
                        <span className="text-5xl font-bold leading-none">{avgPct}%</span>
                        <span className="text-sm text-neutral-400 leading-tight pt-1" style={{ whiteSpace: 'pre-line' }}>{t('reports.avgShare')}</span>
                      </div>
                    );
                  })()}

                  {/* Half Donut */}
                  <div className="flex flex-col items-center mt-6">
                    <svg viewBox="0 0 260 160" className="w-full" style={{ maxWidth: '100%', display: 'block' }}>
                      {(() => {
                        const total = paymentMethods.reduce((s: number, m: any) => s + Number(m.total || 0), 0);
                        const segColors = ['#e0552a', '#c03ab0', '#a060f0', '#9055e8', '#8050e0', '#e08010'];
                        const r = 92;
                        const cx = 130, cy = 105;
                        const sw = 22;
                        const n = paymentMethods.length;
                        const gap = 0.015;
                        const totalGaps = gap * n;
                        const scale = 1 - totalGaps;
                        let cumulative = 0;
                        return paymentMethods.map((m: any, i: number) => {
                          const val = Number(m.total || 0);
                          const pct = total > 0 ? (val / total) * scale : 0;
                          const segStart = cumulative;
                          const segEnd = cumulative + pct;
                          cumulative = segEnd + gap;
                          const startAngle = segStart * 180 - 180;
                          const endAngle = segEnd * 180 - 180;
                          const large = (endAngle - startAngle) > 180 ? 1 : 0;
                          const toRad = (deg: number) => (deg * Math.PI) / 180;
                          const sr = toRad(startAngle), er = toRad(endAngle);
                          const x1 = cx + r * Math.cos(sr), y1 = cy + r * Math.sin(sr);
                          const x2 = cx + r * Math.cos(er), y2 = cy + r * Math.sin(er);
                          const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
                          const isHovered = hoveredPaymentIdx === i;
                          return (
                            <path
                              key={i}
                              d={path}
                              fill="none"
                              stroke={segColors[i % segColors.length]}
                              strokeWidth={sw}
                              opacity={isHovered ? 0.85 : 1}
                              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                              onMouseEnter={() => setHoveredPaymentIdx(i)}
                              onMouseLeave={() => setHoveredPaymentIdx(null)}
                            />
                          );
                        });
                      })()}
                    </svg>
                    {(() => {
                      const total = paymentMethods.reduce((s: number, m: any) => s + Number(m.total || 0), 0);
                      const idx = hoveredPaymentIdx !== null ? hoveredPaymentIdx : 0;
                      const method = paymentMethods[idx];
                      const pct = total > 0 ? ((Number(method?.total || 0) / total) * 100).toFixed(0) : '0';
                      return (
                        <div className="text-center -mt-20">
                          <div className="text-2xl font-bold leading-none">{pct}%</div>
                          <div className="text-sm text-neutral-400 capitalize">{method?.method || ''}</div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

      </div>

      {selectedStat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStat(null)}>
          <div className="w-[min(90vw,400px)] h-[min(80vh,500px)] rounded-[24px] overflow-hidden pt-5 px-5 pb-3 flex flex-col" style={{ background: "#1a1d1f" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSelectedStat(null)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#dc2626", color: "#fff" }}>
                {t('common.close')}
              </button>
            </div>

            {selectedStat === 'revenue' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('reports.totalRevenue')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Math.round(profit.revenue || 0).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#22c55e", color: "#fff" }}>
                    {revenueDelta ? `${revenueDelta.up ? '+' : ''}${Math.abs(revenueDelta.pct)}%` : t('reports.na')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={profitTrend} dataKey="revenue" width={400} height={180} color="#22c55e" />
                </div>
              </>
            )}

            {selectedStat === 'cost' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('reports.totalCost')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Math.round(profit.cost || 0).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    {costDelta ? `${costDelta.up ? '+' : ''}${Math.abs(costDelta.pct)}%` : t('reports.na')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={profitTrend} dataKey="cost" width={400} height={180} color="#3b82f6" />
                </div>
              </>
            )}

            {selectedStat === 'profit' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('reports.netProfit')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Math.round(profit.profit || 0).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#a855f7", color: "#fff" }}>
                    {profitDelta ? `${profitDelta.up ? '+' : ''}${Math.abs(profitDelta.pct)}%` : t('reports.na')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={profitTrend} dataKey="profit" width={400} height={180} color="#a855f7" />
                </div>
              </>
            )}

            {selectedStat === 'margin' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('reports.profitMargin')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    {profitMargin.toFixed(1)}%
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#f97316", color: "#fff" }}>
                    {profitMarginDelta ? `${profitMarginDelta.up ? '+' : ''}${Math.abs(profitMarginDelta.pct)}%` : t('reports.na')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={profitTrend.map((d: any) => { const rev = Number(d.revenue || 0); return { ...d, margin: rev > 0 ? ((Number(d.revenue || 0) - Number(d.cost || 0)) / rev) * 100 : 0 }; })} dataKey="margin" width={400} height={180} color="#f97316" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
