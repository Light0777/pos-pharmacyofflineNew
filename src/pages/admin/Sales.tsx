import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { format as formatDate } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  getSales,
  getInvoice,
  type Invoice,
  type Sale,
} from "../../renderer/services/saleApi";
import { deleteSale } from "../../renderer/services/saleApi";
import { useAuth } from "../../context/AuthContext";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  EyeIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import InvoiceReceipt from "../pos/components/InvoiceReceipt";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SimpleDatePicker from "../../components/SimpleDatePicker";

const formatMoney = (val: any) => {
  const num = Number(val);
  return isNaN(num) ? "0.00" : num.toFixed(2);
};

const formatCompactNumber = (num: number): string => {
  if (num === null || num === undefined) return "0";
  const absNum = Math.abs(num);
  if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
  if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
  if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
  return num.toString();
};

export default function Sales() {
  const { t } = useTranslation();
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoiceData, setInvoiceData] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterDateObj, setFilterDateObj] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [filterPickPos, setFilterPickPos] = useState({ top: 0, right: 0 });
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Sale | null>(null);
  const [invoiceSale, setInvoiceSale] = useState<Sale | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { user } = useAuth();

  useEffect(() => {
    loadSales();
  }, []);

  useEffect(() => {
    if (!showDatePicker || !filterBtnRef.current) return;
    const rect = filterBtnRef.current.getBoundingClientRect();
    setFilterPickPos({ top: rect.bottom + 4, right: document.documentElement.clientWidth - rect.right });
    const handler = (e: MouseEvent) => {
      if (filterBtnRef.current && !filterBtnRef.current.contains(e.target as Node)) {
        const cal = document.getElementById("filter-cal-popup");
        if (cal && !cal.contains(e.target as Node)) {
          setShowDatePicker(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDatePicker]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterDate]);

  const handleDelete = async (sale: Sale) => {
    setDeleting(sale.sale_uuid);
    try {
      const result = await deleteSale(sale.sale_uuid);
      if (result?.success) {
        await loadSales();
      } else {
        alert('Failed to delete: ' + (result?.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    } finally {
      setDeleting(null);
      setDeleteConfirm(null);
    }
  };

  const loadSales = async () => {
    try {
      setLoading(true);
      const response = (await getSales()) as any;

      let salesData = [];
      if (Array.isArray(response)) salesData = response;
      else if (response?.data && Array.isArray(response.data)) salesData = response.data;
      else if (response?.success && response?.data && Array.isArray(response.data)) salesData = response.data;
      else if (response?.sales && Array.isArray(response.sales)) salesData = response.sales;
      else salesData = [];

      const normalised = salesData.map((sale: any) => {
        if (sale.customer?.name) return sale;
        const customerName = sale.customer_name || sale.customerName || sale.customer?.name || t('sales.walkInCustomer');
        const customerMobile = sale.mobile || sale.customer_mobile || sale.customerMobile || sale.customer?.mobile || "";
        return {
          ...sale,
          customer: {
            name: customerName,
            mobile: customerMobile,
          },
        };
      });

      setSales(normalised);
    } catch (e) {
      console.error("Sales error:", e);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  const normaliseInvoice = (raw: any): any => {
    return {
      invoice_number: raw.invoice_number,
      sale_uuid: raw.sale_uuid,
      created_at: raw.created_at,
      date: raw.created_at || raw.date,
      shop: raw.shop || {
        name: "My Store",
        address: "Chennai, Tamil Nadu",
        gstin: "33ABCDE1234F1Z5",
        mobile: ""
      },
      customer: raw.customer || { name: raw.customer_name || t('sales.walkInCustomer') },
      items: (raw.items || raw.cart?.items || []).map((item: any) => ({
        name: item.name || item.product?.name,
        hsn_code: item.hsn_code || item.product?.hsn_code,
        price: Number(item.price || item.product?.price || 0),
        qty: Number(item.qty || item.quantity || 1),
        total: Number(item.total || (item.price * (item.qty || item.quantity || 1))),
        tax_percent: item.gst_percent || item.tax_percent || 0,
        cgst: item.cgst || 0,
        sgst: item.sgst || 0
      })),
      summary: {
        total: Number(raw.summary?.total || raw.subtotal || raw.total || 0),
        tax: Number(raw.summary?.tax || raw.tax || 0),
        cgst: Number(raw.summary?.cgst || (raw.tax || 0) / 2),
        sgst: Number(raw.summary?.sgst || (raw.tax || 0) / 2),
        grand_total: Number(raw.summary?.grand_total || raw.grand_total || raw.total_amount || 0)
      },
      discount: Number(raw.discount || 0),
      payments: raw.payments || []
    };
  };

  const handleView = async (sale: Sale) => {
    try {
      const rawInvoice = await getInvoice(sale.sale_uuid);
      const normalised = normaliseInvoice(rawInvoice);
      setInvoiceData(normalised);
      setInvoiceSale(sale);
      setSales(prevSales =>
        prevSales.map(s =>
          s.sale_uuid === sale.sale_uuid
            ? {
              ...s,
              customer: {
                name: normalised.customer.name,
                mobile: normalised.customer.mobile,
              },
            }
            : s
        )
      );
    } catch (e) {
      console.error("Invoice error:", e);
      alert(t('sales.invoiceLoadError'));
    }
  };

  const totalSales = sales.reduce((sum, sale) => {
    const grandTotal = typeof sale.grand_total === 'string' ? parseFloat(sale.grand_total) : (sale.grand_total || 0);
    return sum + grandTotal;
  }, 0);

  const averageSale = sales.length > 0 ? totalSales / sales.length : 0;

  const todaySales = sales.filter(sale => {
    if (!sale.created_at) return false;
    const saleDate = sale.created_at.slice(0, 10);
    const todayDate = new Date().toISOString().slice(0, 10);
    return saleDate === todayDate;
  }).reduce((sum, sale) => {
    const grandTotal = typeof sale.grand_total === 'string'
      ? parseFloat(sale.grand_total)
      : (sale.grand_total || 0);
    return sum + grandTotal;
  }, 0);

  const filteredSales = sales.filter((sale) => {
    const matchesSearch = !searchTerm ||
      sale.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sale.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || sale.created_at?.startsWith(filterDate);
    return matchesSearch && matchesDate;
  });

  const totalPages = Math.ceil(filteredSales.length / pageSize);
  const paginatedSales = filteredSales.slice((page - 1) * pageSize, page * pageSize);

  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const salesTrend = sales.reduce((acc: any[], sale) => {
    const date = sale.created_at?.slice(0, 10);
    if (!date) return acc;
    const existing = acc.find(d => d.date === date);
    const total = Number(sale.grand_total || 0);
    if (existing) {
      existing.total += total;
      existing.count += 1;
      existing.avg = existing.total / existing.count;
    } else {
      acc.push({ date, total, count: 1, avg: total });
    }
    return acc;
  }, []).sort((a: any, b: any) => a.date.localeCompare(b.date));

  const Sparkline = ({ data: chartData, dataKey, width = 320, height = 100, color = "#22c55e" }: { data: any[], dataKey: string, width?: number, height?: number, color?: string }) => {
    const [hovered, setHovered] = useState(false);
    if (!chartData || chartData.length < 2) return null;
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
    const areaD = `${lineD} L ${width},${height} L 0,${height} Z`;
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
        <path d={areaD} fill={`url(#sg-${dataKey})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth={hovered ? 3.5 : 2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke-width 0.15s' }} />
      </svg>
    );
  };

  const todayTotal = todaySales;
  const avgSale = averageSale;

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 text-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('totalSales')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('sales.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('sales.totalSales')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(Math.round(totalSales))}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#3b82f6", color: "#fff" }}>{t('sales.overallRevenue')}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,60 20,45 35,55 45,30 60,50 75,40 90,52 110,25 130,45 160,38" />
            </svg>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('avgSale')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('sales.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('sales.averageSale')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(Math.round(averageSale))}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#10b981", color: "#fff" }}>{t('sales.perTransaction')}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,55 20,40 35,50 45,25 60,45 75,35 90,48 110,20 130,40 160,32" />
            </svg>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('todaySales')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('sales.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('sales.todaySales')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(Math.round(todaySales))}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#8b5cf6", color: "#fff" }}>{t('sales.last24Hours')}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,60 20,50 35,65 45,20 60,55 75,45 90,58 110,35 130,50 160,42" />
            </svg>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('transactions')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('sales.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('sales.transactions')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">{formatCompactNumber(sales.length)}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#f59e0b", color: "#fff" }}>{t('sales.totalInvoices')}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,50 20,35 35,45 45,20 60,40 75,30 90,42 110,15 130,35 160,28" />
            </svg>
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
            placeholder={t('sales.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-10 py-2.5 bg-white border-slate-200 rounded-xl focus-visible:ring-2 focus-visible:ring-green-500/20 focus-visible:border-green-400 transition-all"
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

        <div className="relative shrink-0">
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
          >
            <CalendarIcon className="w-4 h-4 text-slate-400" />
            <span>{filterDate ? formatDate(new Date(filterDate), "dd MMM yyyy") : t('sales.filterByDate')}</span>
          </button>
          {filterDate && (
            <button
              onClick={() => { setFilterDate(""); setFilterDateObj(undefined); }}
              className="absolute -right-2 -top-2 w-5 h-5 bg-slate-300 hover:bg-slate-400 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {showDatePicker && (
            <div id="filter-cal-popup" className="fixed z-[70]" style={{ top: filterPickPos.top, right: filterPickPos.right }}>
              <SimpleDatePicker
                date={filterDateObj || new Date()}
                onSelect={(d) => { setFilterDate(formatDate(d, "yyyy-MM-dd")); setFilterDateObj(d); setShowDatePicker(false); }}
              />
            </div>
          )}
        </div>

        <Button onClick={loadSales} disabled={loading} variant="outline" className="gap-2 shrink-0">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t('sales.refresh')}
        </Button>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('sales.tableInvoice')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('sales.tableCustomer')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('sales.tableAmount')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('sales.tableDate')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('sales.tableAction')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    <p className="text-slate-500 text-sm">{t('sales.loadingSales')}</p>
                  </div>
                </td>
              </tr>
            ) : paginatedSales.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-slate-500">
                  {searchTerm || filterDate ? t('sales.noSearchResults') : t('sales.noSales')}
                </td>
              </tr>
            ) : (
              paginatedSales.map((sale) => (
                <tr key={sale.sale_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 text-center font-medium text-blue-600">
                    <span title={sale.invoice_number || t('dashboard.na')}>
{sale.invoice_number || t('dashboard.na')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center text-gray-700">
                    {sale.customer_name || t('sales.walkInCustomer')}
                  </td>
                  <td className="px-5 py-3.5 text-center font-semibold text-emerald-600">
                    ₹{formatMoney(sale.grand_total)}
                  </td>
                  <td className="px-5 py-3.5 text-center text-gray-500">
                    {sale.created_at ? formatDate(new Date(sale.created_at), "dd MMM yyyy") : "—"}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => handleView(sale)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                      title={t('sales.viewButton')}
                    >
                      <HugeiconsIcon icon={EyeIcon} className="text-sm"  />
                      {t('sales.viewButton')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-500">
              {t('sales.showing', { start: (page - 1) * pageSize + 1, end: Math.min(page * pageSize, filteredSales.length), total: filteredSales.length })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('sales.prev')}
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
                {t('sales.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">{t('sales.deleteInvoice')}</h3>
            <p className="text-sm text-slate-500 mb-2">
              {t('sales.deleteConfirm', { invoice: deleteConfirm.invoice_number })}
            </p>
            <p className="text-xs text-amber-600 mb-6">{t('sales.stockRestored')}</p>
            <div className="flex gap-3">
              <Button onClick={() => setDeleteConfirm(null)} variant="outline" className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={user?.role !== 'admin' || deleting === deleteConfirm.sale_uuid}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting === deleteConfirm.sale_uuid ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  t('sales.deleteButton')
                )}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Invoice Modal */}
      {invoiceData && (
        <InvoiceReceipt
          invoice={invoiceData}
          onClose={() => { setInvoiceData(null); setInvoiceSale(null); }}
          autoPrint={false}
          onDelete={user?.role === 'admin' ? () => { setDeleteConfirm(invoiceSale); setInvoiceData(null); setInvoiceSale(null); } : undefined}
        />
      )}

      {selectedStat && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStat(null)}>
          <div className="w-[min(90vw,400px)] h-[min(80vh,500px)] rounded-[24px] overflow-hidden pt-5 px-5 pb-3 flex flex-col" style={{ background: "#1a1d1f" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSelectedStat(null)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#dc2626", color: "#fff" }}>
{t('common.close')}
              </button>
            </div>

            {selectedStat === 'totalSales' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('sales.totalSales')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Math.round(totalSales).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    {t('sales.overallRevenue')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={salesTrend} dataKey="total" width={400} height={180} color="#3b82f6" />
                </div>
              </>
            )}

            {selectedStat === 'avgSale' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('sales.averageSale')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Math.round(avgSale).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#10b981", color: "#fff" }}>
                    {t('sales.perTransaction')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={salesTrend} dataKey="avg" width={400} height={180} color="#10b981" />
                </div>
              </>
            )}

            {selectedStat === 'todaySales' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('sales.todaySales')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Math.round(todayTotal).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8b5cf6", color: "#fff" }}>
                    {t('sales.last24Hours')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={salesTrend} dataKey="total" width={400} height={180} color="#8b5cf6" />
                </div>
              </>
            )}

            {selectedStat === 'transactions' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('sales.transactions')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    {sales.length.toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#f59e0b", color: "#fff" }}>
                    {t('sales.totalInvoices')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={salesTrend} dataKey="count" width={400} height={180} color="#f59e0b" />
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
