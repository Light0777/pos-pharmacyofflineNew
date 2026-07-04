import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
} from "recharts";
import { format } from "date-fns";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  EyeIcon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";

import { ChartContainer } from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { getDashboardReport } from "../../renderer/services/reportApi";
import { getSalesTrend } from "../../renderer/services/reportApi";
import { getProfitTrend } from "../../renderer/services/reportApi";
import { getProducts } from "../../renderer/services/productApi";
import { getCustomerSummary, getCreditTrend } from "../../renderer/services/customerApi";
import { getInvoice } from "../../renderer/services/saleApi";
import InvoiceReceipt from "../pos/components/InvoiceReceipt";
import ProfitLineChart from "./ProfitLineChart";
import * as XLSX from "xlsx";

// ── formatCompactNumber
const formatCompactNumber = (num: number): string => {
  if (num === null || num === undefined) return "0";
  const absNum = Math.abs(num);
  if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
  if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
  if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
  return num.toFixed(2);
};

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profitTrend, setProfitTrend] = useState<any[]>([]);
  const [trend, setTrend] = useState<any[]>([]);
  const [customerSummary, setCustomerSummary] = useState<any>(null);
  const [totalProducts, setTotalProducts] = useState(0);
  const [productStats, setProductStats] = useState({ lowStock: 0, outOfStock: 0 });
  const [trendDays, setTrendDays] = useState(7);
  const [showRangeMenu, setShowRangeMenu] = useState(false);
  const [salesPage, setSalesPage] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [chartView, setChartView] = useState("annually");
  const [debtorMonth, setDebtorMonth] = useState("Month");
  const [showDebtorMenu, setShowDebtorMenu] = useState(false);
  const [hoveredDebtor, setHoveredDebtor] = useState<any>(null);
  const [showDebtorModal, setShowDebtorModal] = useState(false);
  const [chartHoverIdx, setChartHoverIdx] = useState<number | null>(null);
  const [creditTrend, setCreditTrend] = useState<Array<{ month: string; total: number }>>([]);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [showLowStock, setShowLowStock] = useState(false);
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [selectedStat, setSelectedStat] = useState<string | null>(null);
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const report = await getDashboardReport();
      setData(
        report || {
          today_sales: 0,
          today_refunds: 0,
          today_net_sales: 0,
          month_sales: 0,
          month_refunds: 0,
          month_net_sales: 0,
          total_sales: 0,
          total_refunds: 0,
          total_net_sales: 0,
          total_orders: 0,
          low_stock: [],
          recent_sales: [],
          recent_purchases: [],
          top_products: [],
        }
      );
      const summary = await getCustomerSummary();
      setCustomerSummary(summary);

      const creditTrendData = await getCreditTrend();
      setCreditTrend(creditTrendData);

      const salesTrend = await getSalesTrend(trendDays);
      if (salesTrend && Array.isArray(salesTrend)) {
        setTrend(
          salesTrend.map((d: any) => ({
            ...d,
            date: d.date ? format(new Date(d.date), "dd MMM") : "—",
          }))
        );
      }

      const profitData = await getProfitTrend(trendDays);
      if (profitData && Array.isArray(profitData)) {
        setProfitTrend(
          profitData.map((d: any) => ({
            ...d,
            date: d.date ? format(new Date(d.date), "dd MMM") : "—",
          }))
        );
      }

      const productsRes = await getProducts(1, 1);
      const totalProd = productsRes?.total ?? 0;
      setTotalProducts(totalProd);

      const lowStockData = report?.low_stock ?? [];
      const outOfStockCount = lowStockData.filter((p: any) => p.stock === 0).length;
      const lowStockCount = lowStockData.length - outOfStockCount;
      setProductStats({ lowStock: lowStockCount, outOfStock: outOfStockCount });
    } catch (err) {
      console.error("Dashboard load error:", err);
      setData({
        today_sales: 0,
        month_sales: 0,
        total_sales: 0,
        total_orders: 0,
        low_stock: [],
        recent_sales: [],
        recent_purchases: [],
        top_products: [],
      });
      setCustomerSummary({
        total_credit: 0,
        customers_with_credit: 0,
        top_debtors: [],
      });
      setCreditTrend([]);
    } finally {
      setLoading(false);
    }
  }, [trendDays]);

  useEffect(() => {
    loadAllData();
  }, [refreshTrigger, loadAllData, trendDays]);

  useEffect(() => {
    const handleRefresh = () => setRefreshTrigger((prev) => prev + 1);
    window.addEventListener("refresh-dashboard", handleRefresh);
    window.addEventListener("focus", handleRefresh);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleRefresh();
    });
    return () => {
      window.removeEventListener("refresh-dashboard", handleRefresh);
      window.removeEventListener("focus", handleRefresh);
    };
  }, []);

  const chartViewData = useMemo(() => {
    if (!profitTrend.length) return [];
    const revenues = profitTrend.map((d: any) => Number(d.revenue || 0));
    const interpolate = (targetLength: number) =>
      Array.from({ length: targetLength }, (_, i) => {
        const srcIdx = (i / targetLength) * revenues.length;
        const idx = Math.floor(srcIdx);
        const frac = srcIdx - idx;
        const val =
          idx < revenues.length - 1
            ? revenues[idx] * (1 - frac) + revenues[idx + 1] * frac
            : revenues[revenues.length - 1];
        return Math.round(val);
      });

    switch (chartView) {
      case "daily": {
        const vals = interpolate(24);
        return Array.from({ length: 24 }, (_, i) => ({
          date: i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`,
          revenue: vals[i], cost: 0, profit: 0,
        }));
      }
      case "weekly": {
        const vals = interpolate(7);
        return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({
          date: d, revenue: vals[i], cost: 0, profit: 0,
        }));
      }
      case "monthly": {
        const vals = interpolate(12);
        return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((m, i) => ({
          date: m, revenue: vals[i], cost: 0, profit: 0,
        }));
      }
      case "annually":
      default:
        return profitTrend.map((d: any) => ({
          date: d.date,
          revenue: Number(d.revenue || 0),
          cost: Number(d.cost || 0),
          profit: Number(d.profit || 0),
        }));
    }
  }, [profitTrend, chartView]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-red-500 text-center p-8">
        {t("dashboard.failedToLoad")}
      </div>
    );
  }

  const currentTotalCredit = customerSummary?.total_credit ?? 0;
  const currentCustomersWithCredit = customerSummary?.customers_with_credit ?? 0;
  const currentTopDebtors = customerSummary?.top_debtors ?? [];

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

  const todaySalesDelta = (() => {
    if (trend.length < 2) return null;
    const sorted = [...trend].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const prev = Number(sorted[sorted.length - 2]?.total) || 0;
    const curr = Number(sorted[sorted.length - 1]?.total) || 0;
    if (prev === 0) return { pct: 0, up: true };
    const pct = ((curr - prev) / prev) * 100;
    return { pct: Math.round(pct * 100) / 100, up: pct >= 0 };
  })();

  const totalRevenue = profitTrend.reduce((sum: number, d: any) => sum + Number(d.revenue || 0), 0);

  const handleViewInvoice = async (saleUuid: string) => {
    try {
      const inv = await getInvoice(saleUuid);
      setInvoiceData(inv);
    } catch (e) {
      console.error("Invoice load error:", e);
    }
  };

  const perPage = 9;
  const totalSales = data.recent_sales?.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalSales / perPage));
  const safePage = Math.min(salesPage, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = data.recent_sales?.slice(start, start + perPage) ?? [];

  const Sparkline = ({ data: chartData, dataKey, width = 320, height = 100, color = "#22c55e" }: { data: any[], dataKey: string, width?: number, height?: number, color?: string }) => {
    const [hovered, setHovered] = useState(false);
    const [containerWidth, setContainerWidth] = useState(width);
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const el = containerRef.current?.parentElement;
      if (el) {
        const resize = () => setContainerWidth(el.clientWidth || width);
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(el);
        return () => ro.disconnect();
      }
    }, []);
    if (!chartData || chartData.length === 0) return null;
    const values = chartData.map((d: any) => Number(d[dataKey]) || 0);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const w = containerWidth;
    const points = values.map((v: number, i: number) => ({
      x: i / (values.length - 1) * w,
      y: 4 + (height - 8) * (1 - (v - min) / range),
    }));

    const smoothPath = (pts: { x: number; y: number }[]) => {
      if (pts.length < 2) return '';
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const p_1 = pts[Math.max(0, i - 2)];
        const p2 = pts[Math.min(pts.length - 1, i + 1)];
        const cp1x = p0.x + (p1.x - p_1.x) / 6;
        const cp1y = p0.y + (p1.y - p_1.y) / 6;
        const cp2x = p1.x - (p2.x - p0.x) / 6;
        const cp2y = p1.y - (p2.y - p0.y) / 6;
        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
      }
      return d;
    };

    const lineD = smoothPath(points);
    const areaD = `${lineD} L ${w},${height} L 0,${height} Z`;

    return (
      <div ref={containerRef} style={{ width: '100%', height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}>
        <defs>
          <linearGradient id={`sg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={hovered ? 0.55 : 0.38} />
            <stop offset="100%" stopColor={color} stopOpacity={hovered ? 0.06 : 0.02} />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#sg-${dataKey})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth={hovered ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke-width 0.15s' }} />
      </svg>
      </div>
    );
  };

  const exportToXLS = () => {
    const rows = (data.recent_sales || []).map((s: any) => [
      s.invoice_number || '',
      s.created_at ? format(new Date(s.created_at), "M/d/yy") : '',
      s.customer_name || t("dashboard.walkIn"),
      Number(s.grand_total || 0),
      Number(s.refund_total || 0),
      s.status === 'completed' || s.status === 'paid' ? 'Paid' : s.status === 'pending' ? 'Pending' : s.status === 'cancelled' ? 'Cancelled' : s.status || 'Paid',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      [t("dashboard.orderId"), t("dashboard.tableDate"), t("dashboard.tableCustomer"), t("dashboard.tablePrice"), t("dashboard.tableRefund"), t("dashboard.tableStatus")],
      ...rows,
    ]);
    ws["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Recent Sales");
    XLSX.writeFile(wb, `Recent_Sales_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-4 sm:p-6 space-y-5 pb-10">

      {/* Product Stats */}
      <div className="flex bg-[#0a0a0a] rounded-xl">
        <div className="flex items-center px-5 py-3 shrink-0 border-r border-white/[0.08]">
          <span className="text-xl font-bold text-white/60 tracking-[0.04em] uppercase whitespace-nowrap">{t("dashboard.quickInventory")}</span>
        </div>
        <div className="flex-1 flex items-center gap-3 px-5 py-3 relative after:content-[''] after:absolute after:right-0 after:top-3 after:bottom-3 after:w-px after:bg-white/[0.08] cursor-pointer" onClick={() => navigate('/admin/products')}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-green-400/15 border border-green-400/35">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#4ade80" opacity="0.9"/>
              <path d="M9 12l2 2 4-4" stroke="#0a0a0a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-semibold text-white/55 tracking-[0.04em] uppercase">{t("dashboard.totalProducts")}</span>
            <span className="text-xl font-bold leading-none tracking-wide text-green-400">{totalProducts.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex-1 relative after:content-[''] after:absolute after:right-0 after:top-3 after:bottom-3 after:w-px after:bg-white/[0.08]">
          <div className="flex items-center gap-3 px-5 py-3 cursor-pointer" onClick={() => setShowLowStock(!showLowStock)}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-lime-400/12 border border-lime-400/35">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#a3e635" opacity="0.85"/>
                <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0a0a0a" fontFamily="sans-serif">!</text>
              </svg>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-semibold text-white/55 tracking-[0.04em] uppercase">{t("dashboard.lowStocks")}</span>
              <span className="text-xl font-bold leading-none tracking-wide text-lime-400">{productStats.lowStock}</span>
            </div>
          </div>
          {showLowStock && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">{t("dashboard.lowStockItems")}</span>
                <button onClick={() => setShowLowStock(false)} className="text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 px-3 py-1 rounded-full transition">{t("common.cancel")}</button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {data.low_stock?.length > 0 ? data.low_stock.map((p: any) => (
                  <div key={p.product_uuid} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-white/90 truncate">{p.name}</p>
                      <p className="text-xs text-white/40 truncate mt-0.5">{t("dashboard.idLabel")}: {p.product_uuid?.slice(0, 8)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-sm font-semibold text-lime-400">{p.stock} {t("dashboard.leftLabel")}</span>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-sm text-white/40">{t("dashboard.allStockGood")}</div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex-1 relative">
          <div className="flex items-center gap-3 px-5 py-3 cursor-pointer" onClick={() => setShowOutOfStock(!showOutOfStock)}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-red-500/15 border border-red-500/35">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#ef4444" opacity="0.9"/>
                <line x1="8" y1="8" x2="16" y2="16" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round"/>
                <line x1="16" y1="8" x2="8" y2="16" stroke="#0a0a0a" strokeWidth="2.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-[11px] font-semibold text-white/55 tracking-[0.04em] uppercase">{t("dashboard.outOfStock")}</span>
              <span className="text-xl font-bold leading-none tracking-wide text-red-400">{productStats.outOfStock}</span>
            </div>
          </div>
          {showOutOfStock && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
                <span className="text-xs font-semibold text-white/60 uppercase tracking-wide">{t("dashboard.outOfStockItems")}</span>
                <button onClick={() => setShowOutOfStock(false)} className="text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 px-3 py-0.5 rounded-full transition">{t("common.cancel")}</button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {data.low_stock?.filter((p: any) => p.stock === 0).length > 0 ? data.low_stock.filter((p: any) => p.stock === 0).map((p: any) => (
                  <div key={p.product_uuid} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-medium text-white/90 truncate">{p.name}</p>
                      <p className="text-xs text-white/40 truncate mt-0.5">ID: {p.product_uuid?.slice(0, 8)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="text-sm font-semibold text-red-400">{p.stock} left</span>
                    </div>
                  </div>
                )) : (
                  <div className="px-4 py-6 text-center text-sm text-white/40">{t("dashboard.noOutOfStock")}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showLowStock && createPortal(<div className="fixed inset-0 z-40" onClick={() => setShowLowStock(false)} />, document.body)}
      {showOutOfStock && createPortal(<div className="fixed inset-0 z-40" onClick={() => setShowOutOfStock(false)} />, document.body)}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 text-start">
        {/* Today's Sales - custom card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('today')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t("dashboard.statistics")}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t("dashboard.todaySales")}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(data.today_net_sales ?? data.today_sales ?? 0)}</p>
            {(data.today_refunds ?? 0) > 0 && (
              <p className="text-xs text-red-500 mt-1">
                {t("dashboard.refunds", { amount: formatCompactNumber(data.today_refunds ?? 0) })}
              </p>
            )}
            {todaySalesDelta && (
              <div className="flex items-center gap-1">
                <span className={`text-sm font-medium ${todaySalesDelta.up ? 'text-green-500' : 'text-red-500'}`}>
                  {todaySalesDelta.up ? '+' : ''}{Math.abs(todaySalesDelta.pct)}%
                </span>
                <svg className={todaySalesDelta.up ? 'text-green-500' : 'text-red-500'} width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: todaySalesDelta.up ? 'none' : 'rotate(180deg)' }}>
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
        {/* Monthly Sales */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('monthly')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t("dashboard.statistics")}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t("dashboard.monthlySales")}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(data.month_net_sales ?? data.month_sales ?? 0)}</p>
            {(data.month_refunds ?? 0) > 0 && (
              <p className="text-xs text-red-500 mt-1">
                {t("dashboard.refunds", { amount: formatCompactNumber(data.month_refunds ?? 0) })}
              </p>
            )}
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#0066FF", color: "#fff" }}>{t("dashboard.thisMonth")}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,60 20,45 35,55 45,30 60,50 75,40 90,52 110,25 130,45 160,38" />
            </svg>
          </div>
        </div>
        {/* Total Sales */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('total')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t("dashboard.statistics")}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t("dashboard.totalSales")}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(data.total_net_sales ?? data.total_sales ?? 0)}</p>
            {(data.total_refunds ?? 0) > 0 && (
              <p className="text-xs text-red-500 mt-1">
                {t("dashboard.refunds", { amount: formatCompactNumber(data.total_refunds ?? 0) })}
              </p>
            )}
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#8800FF", color: "#fff" }}>{t("dashboard.lifetimeRevenue")}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#a855f7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,55 20,40 35,50 45,25 60,45 75,35 90,48 110,20 130,40 160,32" />
            </svg>
          </div>
        </div>
        {/* Total Orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('orders')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t("dashboard.statistics")}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t("dashboard.totalOrders")}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">{(data.total_orders || 0).toLocaleString()}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#FF6600", color: "#fff" }}>{t("dashboard.invoicesProcessed")}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,50 20,35 35,45 45,20 60,40 75,30 90,42 110,15 130,35 160,28" />
            </svg>
          </div>
        </div>
      </div>

      {/* Profit + Credit */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">

        {/* Left: Profit Line Chart */}
        <div className="min-w-0 flex">
          <Card className="border-0 shadow-xl rounded-2xl w-full" style={{ background: "#fff" }}>
            <div className="p-6 sm:p-7 flex flex-col h-full">
              <h2 className="sr-only">Sales area chart showing monthly revenue totals with hover interaction</h2>
              <div className="flex items-start justify-between mb-6 flex-wrap gap-3 shrink-0">
                <div>
                  <p className="text-[13px] text-slate-500 mb-1 text-start font-bold">{t("dashboard.salesYear", { year: new Date().getFullYear() })}</p>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[28px] font-medium text-slate-900">
                      ₹{formatCompactNumber(totalRevenue)}
                    </span>
                    {revenueDelta && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${revenueDelta.up ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"}`}>
                      {revenueDelta.up ? "↑" : "↓"} {Math.abs(revenueDelta.pct)}% {t("dashboard.vsLastYear")}
                    </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 items-center">
                  {["Daily", "Weekly", "Monthly", "Annually"].map((v) => (
                    <button key={v} onClick={() => setChartView(v.toLowerCase())}
                      className={`px-3.5 py-1.5 text-[13px] rounded-full font-medium transition-colors ${chartView === v.toLowerCase() ? "bg-green-600 text-white" : "border border-slate-300 text-slate-500 bg-transparent"}`}
                    >
                      {t("dashboard.chart" + v)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative w-full flex-1 min-h-0">
                <ProfitLineChart data={chartViewData} />
              </div>
            </div>
          </Card>
        </div>

        {/* Right: Credit card + Top Debtors */}
        <div className="flex flex-col gap-5 min-w-0">
          <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-red-100 rounded-md flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <span className="text-sm text-gray-500">{t("dashboard.creditGivenLabel")}</span>
            </div>
            <div className="flex items-baseline gap-2.5 mb-5">
              <span className="text-3xl font-semibold text-gray-900 tracking-tight">₹{formatCompactNumber(currentTotalCredit)}</span>
              {currentCustomersWithCredit > 0 && (
                <span className="text-[13px] font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  {t("dashboard.customerCount", { count: currentCustomersWithCredit })}
                </span>
              )}
            </div>
            {(() => {
              const w = 332, h = 130;
              const hasData = creditTrend.length > 0;
              const chartData = hasData
                ? creditTrend.map(d => {
                    const parts = d.month.split('-');
                    const m = monthNames[parseInt(parts[1]) - 1] || d.month;
                    return { m, v: d.total };
                  })
                : [];
              const pts = chartData.length >= 2
                ? (() => {
                    const vals = chartData.map(d => d.v);
                    const yMin = Math.min(...vals);
                    const yMax = Math.max(...vals);
                    const range = yMax - yMin || 1;
                    const paddedMin = yMin - range * 0.1;
                    const paddedMax = yMax + range * 0.1;
                    return chartData.map((d, i) => ({
                      x: ((i + 0.5) / chartData.length) * w,
                      y: h - ((d.v - paddedMin) / (paddedMax - paddedMin)) * (h - 20) - 10,
                      ...d
                    }));
                  })()
                : [
                    { x: 0, y: h / 2, m: '', v: 0 },
                    { x: w, y: h / 2, m: '', v: 0 },
                  ];
              const linePts = pts.map(p => `${p.x},${p.y}`).join(' ');
              const areaPts = `M${pts[0].x},${h} L${pts.map(p => `${p.x},${p.y}`).join(' L')} L${pts[pts.length - 1].x},${h} Z`;
              return (
                <div className="w-full relative" style={{ height: h }}>
                  <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block', position: 'absolute', inset: 0 }}>
                    <defs>
                      <linearGradient id="redGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#dc2626" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPts} fill="url(#redGrad2)" />
                    <polyline fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={linePts} />
                    {chartHoverIdx !== null && pts.length >= 2 && chartData.length >= 2 && (
                      <>
                        <line x1={pts[chartHoverIdx].x} y1="0" x2={pts[chartHoverIdx].x} y2={h} stroke="#dc2626" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
                        <circle cx={pts[chartHoverIdx].x} cy={pts[chartHoverIdx].y} r="4" fill="#dc2626" stroke="#fff" strokeWidth="2" />
                      </>
                    )}
                  </svg>
                  <div className="absolute inset-0 flex" style={{ height: h }}>
                    {chartData.length >= 2 ? pts.map((p, i) => (
                      <div key={i} className="flex-1 relative" onMouseEnter={() => setChartHoverIdx(i)} onMouseLeave={() => setChartHoverIdx(null)}>
                        {chartHoverIdx === i && (
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 10, pointerEvents: 'none' }}>
                            ₹{p.v.toLocaleString()}
                          </div>
                        )}
                      </div>
                    )) : (
                      <div className="w-full flex items-center justify-center text-[11px] text-gray-400">{t("dashboard.noCreditData")}</div>
                    )}
                  </div>
                </div>
              );
            })()}
            <div className="flex justify-between mt-1.5 text-[11px] text-gray-400">
              {creditTrend.length >= 2
                ? creditTrend.map(d => {
                    const parts = d.month.split('-');
                    const m = monthNames[parseInt(parts[1]) - 1] || d.month;
                    return <span key={d.month}>{m}</span>;
                  })
                : <span className="w-full text-center">—</span>
              }
            </div>
          </div>

          <style>{`@keyframes growUp { from { transform: scaleY(0); opacity: 0; } to { transform: scaleY(1); opacity: 1; } }`}</style>
          <div className="bg-white rounded-[20px] shadow-[0_4px_32px_0_rgba(90,100,200,0.09),0_1px_4px_rgba(0,0,0,0.05)] p-7 pb-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-xs font-medium text-gray-400 tracking-wide uppercase mb-0.5">{t("dashboard.statistics")}</p>
                <h2 className="text-[20px] font-bold text-gray-800 leading-tight">{t("dashboard.topDebtors")}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowDebtorModal(true)} className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f2f3f8] hover:bg-[#e5e7f5] transition-colors" title="Expand">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
                <div className="relative">
                  <button onClick={() => setShowDebtorMenu(!showDebtorMenu)} onBlur={() => setTimeout(() => setShowDebtorMenu(false), 150)} className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f2f3f8] text-[13px] font-medium text-gray-600 hover:bg-[#e5e7f5] transition-colors">
                    {debtorMonth}
                    <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
                      <path d="M5 8l5 5 5-5" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  {showDebtorMenu && (
                    <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50 min-w-[130px]">
                      {[["debtorThisMonth","This Month"],["debtorLastMonth","Last Month"],["debtorLast3Months","Last 3 Months"],["debtorAllTime","All Time"]].map(([key, fallback]) => {
                        const opt = t(`dashboard.${key}`, fallback);
                        return <button key={key} onMouseDown={() => { setDebtorMonth(opt); setShowDebtorMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-slate-50 transition-colors">
                          {opt}
                        </button>;
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {currentTopDebtors.length > 0 ? (() => {
              const maxVal = Math.max(...currentTopDebtors.map((d: any) => d.credit_balance), 1);
              const roundedMax = Math.ceil(maxVal / 100) * 100 || 100;
              const gradients = [
                'linear-gradient(135deg, #a78bfa, #7c3aed)',
                'linear-gradient(135deg, #f9a8d4, #ec4899)',
                'linear-gradient(135deg, #93c5fd, #3b82f6)',
                'linear-gradient(135deg, #fbbf24, #f59e0b)',
                'linear-gradient(135deg, #6ee7b7, #10b981)',
                'linear-gradient(135deg, #fca5a5, #ef4444)',
                'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
              ];
              return (
                <div className="flex gap-0">
                  <div className="flex flex-col justify-between pb-[44px] pr-3" style={{ height: 224 }}>
                    <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[28px] leading-none">{roundedMax}</span>
                    <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[28px] leading-none">{Math.round(roundedMax * 2 / 3)}</span>
                    <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[28px] leading-none">{Math.round(roundedMax / 3)}</span>
                    <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[28px] leading-none">0</span>
                  </div>
                  <div className="flex-1 relative">
                    <div className="absolute inset-x-0 top-0 bottom-[44px] flex flex-col justify-between pointer-events-none">
                      {[0,1,2,3].map(i => <div key={i} className="border-t-[1.5px] border-dashed border-[#eaecf6] w-full" />)}
                    </div>
                    <div className="flex items-end gap-0 relative z-10" style={{ height: 180 }}>
                      {currentTopDebtors.slice(0, 7).map((c: any, i: number) => {
                        const pct = c.credit_balance / roundedMax;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-[10px] h-[180px]">
                            <div className="w-[10px] rounded-full bg-[#e0e6ff] relative flex items-end overflow-hidden" style={{ height: 180 }}>
                              <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] rounded-full bg-[#5f6cf7] shadow-[0_0_0_3px_rgba(95,108,247,0.18)] z-[2]" style={{ bottom: `calc(${pct * 100}% - 5px)` }} />
                              <div className="w-full rounded-full bg-gradient-to-b from-[#6674f4] to-[#a5aeff] animate-[growUp_0.7s_cubic-bezier(.4,0,.2,1)_both] origin-bottom" style={{ height: `${pct * 100}%`, animationDelay: `${0.05 * i}s` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-0 mt-3">
                      {currentTopDebtors.slice(0, 7).map((c: any, i: number) => (
                        <div key={i} className="flex-1 flex justify-center relative">
                          <div onMouseEnter={() => setHoveredDebtor(c)} onMouseLeave={() => setHoveredDebtor(null)} className="w-[34px] h-[34px] rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.10)] flex items-center justify-center text-[13px] font-bold shrink-0 cursor-default" style={{ background: gradients[i % gradients.length], color: '#fff' }}>
                            {c.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          {hoveredDebtor === c && (
                            <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.25)', whiteSpace: 'nowrap', zIndex: 9999, pointerEvents: 'none' }}>
                              {c.name} — ₹{formatCompactNumber(c.credit_balance)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-4xl text-emerald-500"  />
                <p className="text-sm">{t("dashboard.noDebtors")}</p>
                <p className="text-xs">{t("dashboard.allAccountsCleared")}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDebtorModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowDebtorModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[20px] shadow-xl p-8" style={{ width: 'min(90vw, 900px)', maxHeight: '90vh', overflow: 'hidden' }}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-xs font-medium text-gray-400 tracking-wide uppercase mb-0.5">{t("dashboard.statistics")}</p>
                <h2 className="text-[20px] font-bold text-gray-800 leading-tight">{t("dashboard.allDebtors")}</h2>
              </div>
              <button onClick={() => setShowDebtorModal(false)} className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f2f3f8] hover:bg-[#e5e7f5] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {currentTopDebtors.length > 0 ? (() => {
              const all = currentTopDebtors;
              const maxVal = Math.max(...all.map((d: any) => d.credit_balance), 1);
              const roundedMax = Math.ceil(maxVal / 100) * 100 || 100;
              const gradients = [
                'linear-gradient(135deg, #a78bfa, #7c3aed)',
                'linear-gradient(135deg, #f9a8d4, #ec4899)',
                'linear-gradient(135deg, #93c5fd, #3b82f6)',
                'linear-gradient(135deg, #fbbf24, #f59e0b)',
                'linear-gradient(135deg, #6ee7b7, #10b981)',
                'linear-gradient(135deg, #fca5a5, #ef4444)',
                'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
              ];
              return (
                <div>
                  <div className="flex gap-0 mb-8">
                    <div className="flex flex-col justify-between pb-[44px] pr-3" style={{ height: 260 }}>
                      <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[32px] leading-none">{roundedMax}</span>
                      <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[32px] leading-none">{Math.round(roundedMax * 2 / 3)}</span>
                      <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[32px] leading-none">{Math.round(roundedMax / 3)}</span>
                      <span className="text-[11.5px] text-[#c0c4d6] font-medium text-right min-w-[32px] leading-none">0</span>
                    </div>
                    <div className="flex-1 relative" style={{ minHeight: 260 }}>
                      <div className="absolute inset-x-0 top-0 bottom-[44px] flex flex-col justify-between pointer-events-none">
                        {[0,1,2,3].map(i => <div key={i} className="border-t-[1.5px] border-dashed border-[#eaecf6] w-full" />)}
                      </div>
                      <div className="flex items-end gap-0 relative z-10" style={{ height: 216 }}>
                        {all.map((c: any, i: number) => {
                          const pct = c.credit_balance / roundedMax;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-[10px] h-[216px]">
                              <div className="w-[10px] rounded-full bg-[#e0e6ff] relative flex items-end overflow-hidden" style={{ height: 216 }}>
                                <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] rounded-full bg-[#5f6cf7] shadow-[0_0_0_3px_rgba(95,108,247,0.18)] z-[2]" style={{ bottom: `calc(${pct * 100}% - 5px)` }} />
                                <div className="w-full rounded-full bg-gradient-to-b from-[#6674f4] to-[#a5aeff] animate-[growUp_0.7s_cubic-bezier(.4,0,.2,1)_both] origin-bottom" style={{ height: `${pct * 100}%`, animationDelay: `${0.05 * i}s` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-0 mt-3">
                        {all.map((c: any, i: number) => (
                          <div key={i} className="flex-1 flex justify-center relative">
                            <div className="w-[34px] h-[34px] rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.10)] flex items-center justify-center text-[13px] font-bold shrink-0 cursor-default" style={{ background: gradients[i % gradients.length], color: '#fff' }}>
                              {c.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <div className="table-scroll">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-xs text-gray-400 uppercase tracking-wide">
                          <th className="pb-2 pr-2">#</th>
                          <th className="pb-2 pr-2">{t("dashboard.debtorName")}</th>
                          <th className="pb-2 pr-2 text-right">{t("dashboard.debtorDebt")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {all.map((c: any, i: number) => (
                          <tr key={i} className="border-b border-slate-50 last:border-0">
                            <td className="py-2.5 pr-2 text-sm text-gray-400">{i + 1}</td>
                            <td className="py-2.5 pr-2 text-sm font-medium text-gray-700">{c.name}</td>
                            <td className="py-2.5 text-sm font-semibold text-red-600 text-right">₹{formatCompactNumber(c.credit_balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-8 text-slate-400 flex flex-col items-center gap-2">
                <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-4xl text-emerald-500"  />
                <p className="text-sm">{t("dashboard.noDebtors")}</p>
                <p className="text-xs">{t("dashboard.allAccountsCleared")}</p>
              </div>
            )}
          </div>
        </div>
      , document.body)}

      {/* Orders */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">{t("dashboard.recentSales")}</span>
          <button
            onClick={exportToXLS}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to XLS
          </button>
        </div>
        <div className="table-scroll">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dashboard.orderId")}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dashboard.tableDate")}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dashboard.tableCustomer")}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dashboard.tablePrice")}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dashboard.tableRefund")}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dashboard.tableStatus")}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dashboard.tableAction")}</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((s: any) => {
              const statusMap: Record<string, { label: string; classes: string }> = {
                completed: { label: t("dashboard.paid"), classes: "bg-green-100 text-green-700" },
                paid: { label: t("dashboard.paid"), classes: "bg-green-100 text-green-700" },
                pending: { label: t("dashboard.pending"), classes: "bg-amber-100 text-amber-700" },
                cancelled: { label: t("dashboard.cancelled"), classes: "bg-red-100 text-red-600" },
              };
              const st = statusMap[s.status] || { label: s.status || "Paid", classes: "bg-gray-100 text-gray-600" };
              return (
                <tr key={s.sale_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-blue-600">#{s.invoice_number}</td>
                  <td className="px-5 py-3.5 text-gray-500">{s.created_at ? format(new Date(s.created_at), "M/d/yy") : "—"}</td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-800">{s.customer_name || t("dashboard.walkIn")}</p>
                    {s.customer_name && <p className="text-xs text-gray-400 mt-0.5">{t("dashboard.regular")}</p>}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">₹{Number(s.grand_total).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3.5 text-center">
                    {Number(s.refund_total) > 0 ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                        -₹{Number(s.refund_total).toLocaleString('en-IN')}
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
                    <button onClick={() => handleViewInvoice(s.sale_uuid)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md p-1.5 transition-colors" title={t("dashboard.viewInvoice")}>
                      <HugeiconsIcon icon={EyeIcon} className="text-lg"  />
                    </button>
                  </td>
                </tr>
              );
            })}
            {pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">{t("dashboard.noRecentSales")}</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-5">
          <button
            onClick={() => setSalesPage(safePage - 1)}
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
                  onClick={() => setSalesPage(p)}
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
            onClick={() => setSalesPage(safePage + 1)}
            disabled={safePage >= totalPages}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >›</button>
        </div>
      )}



      {invoiceData && (
        <InvoiceReceipt
          invoice={invoiceData}
          onClose={() => setInvoiceData(null)}
          autoPrint={false}
        />
      )}

      {selectedStat && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStat(null)}>
          <div className="w-[min(90vw,400px)] h-[min(80vh,500px)] rounded-[24px] overflow-hidden pt-5 px-5 pb-3 flex flex-col" style={{ background: "#1a1d1f" }} onClick={(e) => e.stopPropagation()}>
            {/* Close X button */}
            <div className="flex justify-end mb-1">
              <button onClick={() => setSelectedStat(null)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#dc2626", color: "#fff" }}>
                {t("common.close")}
              </button>
            </div>

            {selectedStat === 'today' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t("dashboard.todayNetRevenue")}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Number(data.today_net_sales ?? data.today_sales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {(data.today_refunds ?? 0) > 0 && (
                    <p className="text-xs text-red-400 mt-2">
                      {t("dashboard.grossAndRefunds", { gross: Number(data.today_sales ?? 0).toLocaleString('en-IN'), refunds: Number(data.today_refunds ?? 0).toLocaleString('en-IN') })}
                    </p>
                  )}
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: todaySalesDelta?.up ? "#22c55e" : "#ef4444", color: "#fff" }}>
                    {todaySalesDelta ? `${todaySalesDelta.up ? '+' : ''}${todaySalesDelta.pct}%` : t("dashboard.na")}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trend.slice(-20)} dataKey="total" width={400} height={180} color={todaySalesDelta?.up ? "#22c55e" : "#ef4444"} />
                </div>
              </>
            )}

            {selectedStat === 'monthly' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t("dashboard.monthlyNetRevenue")}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Number(data.month_net_sales ?? data.month_sales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {(data.month_refunds ?? 0) > 0 && (
                    <p className="text-xs text-red-400 mt-2">
                      {t("dashboard.grossAndRefunds", { gross: Number(data.month_sales ?? 0).toLocaleString('en-IN'), refunds: Number(data.month_refunds ?? 0).toLocaleString('en-IN') })}
                    </p>
                  )}
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#0066FF", color: "#fff" }}>
                    {t("dashboard.thisMonth")}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={profitTrend.length > 0 ? profitTrend : trend.slice(-20)} dataKey="revenue" width={400} height={180} color="#0066FF" />
                </div>
              </>
            )}

            {selectedStat === 'total' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t("dashboard.lifetimeNetRevenue")}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Number(data.total_net_sales ?? data.total_sales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  {(data.total_refunds ?? 0) > 0 && (
                    <p className="text-xs text-red-400 mt-2">
                      {t("dashboard.grossAndRefunds", { gross: Number(data.total_sales ?? 0).toLocaleString('en-IN'), refunds: Number(data.total_refunds ?? 0).toLocaleString('en-IN') })}
                    </p>
                  )}
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8800FF", color: "#fff" }}>
                    {t("dashboard.lifetimeRevenue")}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={profitTrend.length > 0 ? profitTrend : trend.slice(-20)} dataKey="profit" width={400} height={180} color="#8800FF" />
                </div>
              </>
            )}

            {selectedStat === 'orders' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t("dashboard.totalOrders")}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    {(data.total_orders || 0).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#FF6600", color: "#fff" }}>
                    {t("dashboard.invoicesProcessed")}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trend.slice(-20)} dataKey="total" width={400} height={180} color="#FF6600" />
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
