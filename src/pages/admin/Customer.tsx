import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../../renderer/services/customerApi";
import CustomerLedgerModal from "./CustomerLedgerPage";
import { apiGet } from "../../renderer/services/api";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  UserAdd01Icon,
  Edit01Icon,
  EyeIcon,
  Cancel01Icon,
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

// shadcn/ui components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const formatCompactNumber = (num: number): string => {
  if (num === null || num === undefined) return "0";
  const absNum = Math.abs(num);
  if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
  if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
  if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
  return num.toLocaleString();
};

export default function CustomerPage() {
  const { t } = useTranslation();
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pageC, setPageC] = useState(1);
  const pageSize = 10;

  const [form, setForm] = useState({
    name: "",
    mobile: "",
    address: "",
    gstin: "",
    credit_limit: 0,
  });

  const [aging, setAging] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("customers");
  const [pageAging, setPageAging] = useState(1);
  const [pageReminders, setPageReminders] = useState(1);

  // Load all data
  useEffect(() => {
    loadCustomers();
    loadInsights();
  }, []);

  const loadAllCustomerData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCustomers(), loadInsights()]);
    } catch (error) {
      console.error("Error loading customer data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllCustomerData();
  }, [refreshKey, loadAllCustomerData]);

  useEffect(() => {
    const handleRefresh = () => setRefreshKey(prev => prev + 1);
    window.addEventListener('refresh-customers', handleRefresh);
    return () => window.removeEventListener('refresh-customers', handleRefresh);
  }, []);

  const loadCustomers = async () => {
    try {
      const data = await getCustomers();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error loading customers:", e);
      setCustomers([]);
    }
  };

  const loadInsights = async () => {
    try {
      const [agingResponse, reminderResponse] = await Promise.all([
        apiGet("/customers/aging"),
        apiGet("/customers/reminders"),
      ]);

      let agingData = [];
      if (agingResponse.success && agingResponse.data) agingData = agingResponse.data;
      else if (agingResponse.data && Array.isArray(agingResponse.data)) agingData = agingResponse.data;
      else if (Array.isArray(agingResponse)) agingData = agingResponse;

      let reminderData = [];
      if (reminderResponse.success && reminderResponse.data) reminderData = reminderResponse.data;
      else if (reminderResponse.data && Array.isArray(reminderResponse.data)) reminderData = reminderResponse.data;
      else if (Array.isArray(reminderResponse)) reminderData = reminderResponse;

      setAging(agingData);
      setReminders(reminderData);
    } catch (e) {
      console.error("Insights error:", e);
      setAging([]);
      setReminders([]);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", mobile: "", address: "", gstin: "", credit_limit: 0 });
    setDialogOpen(false);
  };

  const handleSave = async () => {
    if (!form.name) return alert(t('customers.nameRequired'));
    try {
      if (editing) {
        await updateCustomer(editing.customer_uuid, form);
        alert(t('customers.updateSuccess'));
      } else {
        await createCustomer(form);
        alert(t('customers.createSuccess'));
      }
      await loadCustomers();
      resetForm();
    } catch (e) {
      console.error(e);
      alert(t('customers.saveFailed'));
    }
  };

  const handleEdit = (c: any) => {
    setEditing(c);
    setForm({
      name: c.name,
      mobile: c.mobile || "",
      address: c.address || "",
      gstin: c.gstin || "",
      credit_limit: c.credit_limit || 0,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm(t('customers.deleteConfirm'))) {
      setDeleting(null);
      return;
    }
    try {
      await deleteCustomer(uuid);
      setDeleting(null);
      alert(t('customers.deleteSuccess'));
      await loadCustomers();
    } catch (e) {
      console.error("Delete failed:", e);
      setDeleting(null);
      alert(t('customers.deleteFailed'));
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.mobile?.includes(searchTerm)
  );

  const filteredAging = aging.filter((c) =>
    c.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReminders = reminders.filter((r) =>
    r.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice((pageC - 1) * pageSize, pageC * pageSize);

  const totalAgingPages = Math.ceil(filteredAging.length / pageSize);
  const paginatedAging = filteredAging.slice((pageAging - 1) * pageSize, pageAging * pageSize);
  const totalRemindersPages = Math.ceil(filteredReminders.length / pageSize);
  const paginatedReminders = filteredReminders.slice((pageReminders - 1) * pageSize, pageReminders * pageSize);

  useEffect(() => {
    setPageC(1);
    setPageAging(1);
    setPageReminders(1);
  }, [searchTerm]);

  useEffect(() => {
    setPageAging(1);
  }, [aging]);

  useEffect(() => {
    setPageReminders(1);
  }, [reminders]);

  const totalCustomers = customers.length;
  const totalCredit = customers.reduce((sum, c) => sum + (Number(c.credit_balance) || 0), 0);
  const overdueCustomers = customers.filter((c) => (Number(c.credit_balance) || 0) > (Number(c.credit_limit) || 0)).length;
  const activeCustomers = customers.filter((c) => (Number(c.credit_balance) || 0) === 0).length;

  const [selectedStat, setSelectedStat] = useState<string | null>(null);

  const trendData = useMemo(() => {
    const gen = (count: number, peak: number) => {
      const pts: number[] = [];
      for (let i = 0; i < 20; i++) {
        const base = (i / 19) * peak;
        pts.push(Math.max(0, Math.round(base * (0.7 + ((i * 7 + 13) % 10) / 20))));
      }
      return pts;
    };
    return {
      total: gen(totalCustomers, totalCustomers),
      credit: gen(totalCredit, totalCredit),
      overdue: gen(overdueCustomers, overdueCustomers),
      active: gen(activeCustomers, activeCustomers),
    };
  }, [totalCustomers, totalCredit, overdueCustomers, activeCustomers]);

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


      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 text-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('totalCustomers')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('customers.totalCustomers')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">{totalCustomers}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#3b82f6", color: "#fff" }}>Total</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,60 20,45 35,55 45,30 60,50 75,40 90,52 110,25 130,45 160,38" />
            </svg>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('creditOutstanding')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('customers.totalCreditOutstanding')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">₹{formatCompactNumber(Math.round(totalCredit))}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#8b5cf6", color: "#fff" }}>Outstanding</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,50 20,35 35,45 45,20 60,40 75,30 90,42 110,15 130,35 160,28" />
            </svg>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('overdue')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('customers.overdueAccounts')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">{overdueCustomers}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#f59e0b", color: "#fff" }}>Overdue</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,55 20,40 35,50 45,25 60,45 75,35 90,48 110,20 130,40 160,32" />
            </svg>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('active')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('customers.activeCustomers')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none mb-2">{activeCustomers}</p>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold leading-none" style={{ backgroundColor: "#10b981", color: "#fff" }}>Active</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <svg viewBox="0 0 160 80" preserveAspectRatio="none" className="w-full h-16">
              <polyline fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="0,60 20,50 35,65 45,20 60,55 75,45 90,58 110,35 130,50 160,42" />
            </svg>
          </div>
        </div>
      </div>

      {/* Tabbed Data Section */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab("customers")}
            className={`px-5 py-3 text-sm font-medium transition-colors relative ${activeTab === "customers" ? "text-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t('customers.customerList')}
            {activeTab === "customers" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
          </button>
          <button
            onClick={() => setActiveTab("aging")}
            className={`px-5 py-3 text-sm font-medium transition-colors relative ${activeTab === "aging" ? "text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t('customers.creditAging')}
            {activeTab === "aging" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-600" />}
          </button>
          <button
            onClick={() => setActiveTab("reminders")}
            className={`px-5 py-3 text-sm font-medium transition-colors relative ${activeTab === "reminders" ? "text-red-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t('customers.paymentReminders')}
            {activeTab === "reminders" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600" />}
          </button>
        </div>

        {/* Search + Add Customer */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"  />
            <Input
              placeholder={t('customers.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-10 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
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
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2 bg-green-500 text-white shrink-0">
            <HugeiconsIcon icon={UserAdd01Icon} className="text-xl"  />
            {t('customers.addCustomer')}
          </Button>
        </div>

        {/* ── Tab: Customer List ── */}
        {activeTab === "customers" && (
          <>
            {/* Table */}
            <div className="table-scroll">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500">Mobile</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Credit Balance</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Credit Limit</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Pay</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      {searchTerm ? t('customers.noSearchResults') : t('customers.noCustomers')}
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map((c) => {
                    const creditBalance = Number(c.credit_balance) || 0;
                    const creditLimit = Number(c.credit_limit) || 0;
                    const isOverdue = creditBalance > creditLimit;
                    return (
                      <tr key={c.customer_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <span className="text-blue-600 font-semibold text-xs">{c.name?.charAt(0).toUpperCase() || '?'}</span>
                            </div>
                            <span className="font-medium text-gray-800 truncate">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500">{c.mobile || "—"}</td>
                        <td className="px-5 py-3.5 text-center font-medium text-gray-800">₹{creditBalance.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-center text-gray-600">₹{creditLimit.toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-center">
                          {isOverdue ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Overdue</span>
                          ) : creditBalance > 0 ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Active</span>
                          ) : (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Cleared</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => setSelectedCustomer(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>
                            </svg>
                            Pay
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleEdit(c)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Showing {(pageC - 1) * pageSize + 1}–{Math.min(pageC * pageSize, filteredCustomers.length)} of {filteredCustomers.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPageC(p => Math.max(1, p - 1))} disabled={pageC === 1} className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                  {(() => {
                    const pages: (number | string)[] = [];
                    const range = 2;
                    for (let i = 1; i <= totalPages; i++) {
                      if (i === 1 || i === totalPages || (i >= pageC - range && i <= pageC + range)) {
                        pages.push(i);
                      } else if (pages[pages.length - 1] !== '...') {
                        pages.push('...');
                      }
                    }
                    return pages.map((p, idx) =>
                      p === '...' ? (
                        <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                      ) : (
                        <button key={p} onClick={() => setPageC(p as number)} className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${p === pageC ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                      )
                    );
                  })()}
                  <button onClick={() => setPageC(p => Math.min(totalPages, p + 1))} disabled={pageC === totalPages} className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Tab: Credit Aging ── */}
        {activeTab === "aging" && (
          <div>
            <div className="overflow-x-auto">
              {filteredAging.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">{searchTerm ? t('customers.noSearchResults') : t('customers.noAgingData')}</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Customer</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">0-30 days</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">31-60 days</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">61-90 days</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">90+ days</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Total</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Pay</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAging.map((c, i) => {
                      const total = (Number(c.aging?.["0_30"]) || 0) + (Number(c.aging?.["31_60"]) || 0) + (Number(c.aging?.["61_90"]) || 0) + (Number(c.aging?.["90_plus"]) || 0);
                      return (
                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-gray-800">{c.name}</td>
                          <td className="px-5 py-3.5 text-center text-gray-700">₹{(Number(c.aging?.["0_30"]) || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-center text-gray-700">₹{(Number(c.aging?.["31_60"]) || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-center text-gray-700">₹{(Number(c.aging?.["61_90"]) || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-center text-red-600 font-medium">₹{(Number(c.aging?.["90_plus"]) || 0).toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-center font-semibold text-gray-900">₹{total.toLocaleString()}</td>
                          <td className="px-5 py-3.5 text-center">
                             <button
                               onClick={() => setSelectedCustomer(c)}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                             >
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                 <path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>
                               </svg>
                               Pay
                             </button>
                           </td>
                           <td className="px-5 py-3.5 text-center">
                             <button
                               onClick={() => handleEdit(c)}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                             >
                               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                 <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                               </svg>
                               Edit
                             </button>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               )}
             </div>
             {totalAgingPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Showing {(pageAging - 1) * pageSize + 1}–{Math.min(pageAging * pageSize, filteredAging.length)} of {filteredAging.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPageAging(p => Math.max(1, p - 1))} disabled={pageAging === 1} className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                  {(() => {
                    const pages: (number | string)[] = [];
                    const range = 2;
                    for (let i = 1; i <= totalAgingPages; i++) {
                      if (i === 1 || i === totalAgingPages || (i >= pageAging - range && i <= pageAging + range)) {
                        pages.push(i);
                      } else if (pages[pages.length - 1] !== '...') {
                        pages.push('...');
                      }
                    }
                    return pages.map((p, idx) =>
                      p === '...' ? (
                        <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                      ) : (
                        <button key={p} onClick={() => setPageAging(p as number)} className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${p === pageAging ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                      )
                    );
                  })()}
                  <button onClick={() => setPageAging(p => Math.min(totalAgingPages, p + 1))} disabled={pageAging === totalAgingPages} className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Payment Reminders ── */}
        {activeTab === "reminders" && (
          <div>
            <div className="overflow-x-auto">
              {filteredReminders.length === 0 ? (
                <div className="text-center py-12 text-emerald-600 text-sm flex items-center justify-center gap-2">
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-lg"  />
                  {reminders.length === 0 ? t('customers.noPendingDues') : t('customers.noSearchResults')}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Customer</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Days Overdue</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Due Amount</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Pay</th>
                      <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedReminders.map((r: any, i) => (
                      <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-gray-800">{r.name}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{r.days}d overdue</span>
                        </td>
                        <td className="px-5 py-3.5 text-center font-semibold text-red-600">₹{(r.due || 0).toLocaleString()}</td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => setSelectedCustomer(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 13 8.5 8"/><path d="M6 13h3"/><path d="M9 13c6.667 0 6.667-10 0-10"/>
                            </svg>
                            Pay
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => handleEdit(r)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {totalRemindersPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">
                  Showing {(pageReminders - 1) * pageSize + 1}–{Math.min(pageReminders * pageSize, filteredReminders.length)} of {filteredReminders.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPageReminders(p => Math.max(1, p - 1))} disabled={pageReminders === 1} className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Prev</button>
                  {(() => {
                    const pages: (number | string)[] = [];
                    const range = 2;
                    for (let i = 1; i <= totalRemindersPages; i++) {
                      if (i === 1 || i === totalRemindersPages || (i >= pageReminders - range && i <= pageReminders + range)) {
                        pages.push(i);
                      } else if (pages[pages.length - 1] !== '...') {
                        pages.push('...');
                      }
                    }
                    return pages.map((p, idx) =>
                      p === '...' ? (
                        <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">…</span>
                      ) : (
                        <button key={p} onClick={() => setPageReminders(p as number)} className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${p === pageReminders ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                      )
                    );
                  })()}
                  <button onClick={() => setPageReminders(p => Math.min(totalRemindersPages, p + 1))} disabled={pageReminders === totalRemindersPages} className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                {editing ? t('customers.editCustomer') : t('customers.addNewCustomer')}
              </h2>
              <button onClick={resetForm} className="text-slate-400 hover:text-slate-600 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('customers.nameField')} *
                </label>
                <Input
                  placeholder={t('customers.namePlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('customers.mobileField')}
                </label>
                <Input
                  placeholder={t('customers.mobilePlaceholder')}
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('customers.addressField')}
                </label>
                <Textarea
                  rows={3}
                  placeholder={t('customers.addressPlaceholder')}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('customers.gstinField')}
                </label>
                <Input
                  placeholder={t('customers.gstinPlaceholder')}
                  value={form.gstin}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('customers.creditLimitField')}
                </label>
                <Input
                  type="number"
                  placeholder={t('customers.creditLimitPlaceholder')}
                  value={form.credit_limit || ""}
                  onChange={(e) => setForm({ ...form, credit_limit: e.target.value === "" ? 0 : Number(e.target.value) })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-search-cancel-button]:appearance-none [appearance:textfield]"
                />
              </div>
              {editing && (
                <div className="border-2 border-dashed border-red-300 rounded-xl p-4 bg-red-50">
                  <div className="flex items-center gap-2 mb-2">
                    <HugeiconsIcon icon={AlertCircleIcon} className="text-lg text-red-500 shrink-0"  />
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Danger Zone</p>
                  </div>
                  <p className="text-xs text-red-500 mb-3">Deleting this customer will remove them permanently. This action cannot be undone.</p>
                  <button
                    onClick={() => {
                      setDeleting(editing.customer_uuid);
                      handleDelete(editing.customer_uuid);
                    }}
                    disabled={deleting === editing.customer_uuid}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    {deleting === editing.customer_uuid ? "Deleting…" : "Delete Customer"}
                  </button>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white">
              <Button variant="outline" onClick={resetForm} className="border-slate-300 text-slate-700 hover:bg-slate-100">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-900/20">
                {loading ? (editing ? t('customers.updating') : t('customers.adding')) : (editing ? t('customers.updateCustomer') : t('customers.createCustomer'))}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {selectedCustomer && (
        <CustomerLedgerModal
          customer={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}

      {selectedStat && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStat(null)}>
          <div className="w-[min(90vw,400px)] h-[min(80vh,500px)] rounded-[24px] overflow-hidden pt-5 px-5 pb-3 flex flex-col" style={{ background: "#1a1d1f" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSelectedStat(null)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#dc2626", color: "#fff" }}>
                Close
              </button>
            </div>

            {selectedStat === 'totalCustomers' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Total Customers</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    {totalCustomers.toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    Total
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.total} width={400} height={180} color="#3b82f6" />
                </div>
              </>
            )}

            {selectedStat === 'creditOutstanding' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Credit Outstanding</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    ₹{Math.round(totalCredit).toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8b5cf6", color: "#fff" }}>
                    Outstanding
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.credit} width={400} height={180} color="#8b5cf6" />
                </div>
              </>
            )}

            {selectedStat === 'overdue' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Overdue Accounts</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    {overdueCustomers.toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#f59e0b", color: "#fff" }}>
                    Overdue
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.overdue} width={400} height={180} color="#f59e0b" />
                </div>
              </>
            )}

            {selectedStat === 'active' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Active Customers</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">
                    {activeCustomers.toLocaleString('en-IN')}
                  </p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#10b981", color: "#fff" }}>
                    Active
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.active} width={400} height={180} color="#10b981" />
                </div>
              </>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
