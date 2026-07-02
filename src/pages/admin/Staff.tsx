import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
  type Staff,
} from "../../renderer/services/staffApi";

const SECURITY_QUESTIONS = [
  "What is your pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite book?",
  "What is your favorite movie?",
  "What was the model of your first car?",
  "What is your favorite food?",
];
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete01Icon,
  Search01Icon,
  Cancel01Icon,
  UserGroupIcon,
  Mail01Icon,
  Key01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";

// shadcn/ui components (only those that work)
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";



export default function StaffPage() {
  const { t } = useTranslation();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "cashier",
    security_question: "",
    security_answer: "",
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStaff();
      setStaff(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load staff error:", err);
      setError(t('staff.loadError'));
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      setError(t('staff.validationRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await createStaff({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        security_question: form.security_question || undefined,
        security_answer: form.security_answer || undefined,
      });
      if ('error' in res) {
        setError((res as { error: string }).error);
        return;
      }
      await loadStaff();
      setSuccess(t('staff.createSuccess'));
      setTimeout(() => setSuccess(null), 3000);
      resetForm();
      setModalOpen(false);
    } catch (err) {
      console.error("Create staff error:", err);
      setError(t('staff.createError'));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (s: Staff) => {
    setEditing(s);
    setForm({
      name: s.name,
      email: s.email,
      password: "",
      role: s.role,
      security_question: (s as any).security_question || "",
      security_answer: "",
    });
    setModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editing) return;

    setLoading(true);
    setError(null);

    try {
      const res = await updateStaff(editing.user_uuid, {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        role: form.role,
        security_question: form.security_question || undefined,
        security_answer: form.security_answer || undefined,
      });
      if ('error' in res) {
        setError((res as { error: string }).error);
        return;
      }
      await loadStaff();
      setSuccess(t('staff.updateSuccess'));
      setTimeout(() => setSuccess(null), 3000);
      resetForm();
      setModalOpen(false);
    } catch (err) {
      console.error("Update staff error:", err);
      setError(t('staff.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!confirm(t('staff.deleteConfirm'))) return;

    setLoading(true);
    setError(null);

    try {
      await deleteStaff(uuid);
      await loadStaff();
      setSuccess(t('staff.deleteSuccess'));
      setTimeout(() => setSuccess(null), 3000);
      setModalOpen(false);
      resetForm();
    } catch (err) {
      console.error("Delete staff error:", err);
      setError(t('staff.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      password: "",
      role: "cashier",
      security_question: "",
      security_answer: "",
    });
  };

  const filteredStaff = staff.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStaff = staff.length;
  const managers = staff.filter((s) => s.role === "manager").length;
  const cashiers = staff.filter((s) => s.role === "cashier").length;

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
      total: gen(totalStaff),
      mgr: gen(managers),
      cash: gen(cashiers),
    };
  }, [totalStaff, managers, cashiers]);

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

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      {/* Success/Error Messages */}
      {success && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-2 text-emerald-700">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-xl"  />
            <p className="text-sm">{success}</p>
          </CardContent>
        </Card>
      )}
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
          <button onClick={() => setSelectedStat('total')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('staff.totalStaff')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{totalStaff}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('mgr')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('staff.managers')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{managers}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('cash')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Statistics</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('staff.cashiers')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{cashiers}</p>
          </div>
        </div>
      </div>

      {/* Search Bar + Add Button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"  />
          <Input
            placeholder={t('staff.searchPlaceholder')}
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
        {staff.length < 2 && (
        <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2 bg-green-600 hover:bg-green-700 text-white shrink-0">
          <HugeiconsIcon icon={Add01Icon} className="text-xl"  />
          {t('staff.addStaff')}
        </Button>
        )}
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-start px-5 py-3 text-xs font-medium text-gray-500">{t('staff.tableStaffMember')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('staff.tableContact')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('staff.tableRole')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('staff.tableActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && staff.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                </td>
              </tr>
            ) : filteredStaff.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <HugeiconsIcon icon={UserGroupIcon} className="text-6xl text-slate-300"  />
                    <p className="text-lg">{t('staff.noStaff')}</p>
                    <p className="text-sm">{searchTerm ? t('staff.noSearchResults') : t('staff.noStaffSubtext')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredStaff.map((s) => (
                <tr key={s.user_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-slate-800 truncate">{s.name}</div>
                        <div className="text-xs text-slate-400 font-mono truncate">
                          {t('staff.idLabel')}: {s.user_uuid?.slice(0, 8)}...
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1 text-sm text-slate-600">
                      <HugeiconsIcon icon={Mail01Icon} className="text-xs shrink-0"  />
                      <span className="truncate">{s.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      s.role === "manager"
                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                        : "bg-blue-100 text-blue-700 border border-blue-200"
                    }`}>
                      {s.role === "manager" ? t('staff.roleManager') : t('staff.roleCashier')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={() => startEdit(s)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Custom Modal */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setModalOpen(false); resetForm(); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                {editing ? t('staff.editStaff') : t('staff.addNewStaff')}
              </h2>
              <button onClick={() => { setModalOpen(false); resetForm(); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('staff.fullNameLabel')} *
                </label>
                <Input
                  placeholder={t('staff.namePlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('staff.emailLabel')} *
                </label>
                <Input
                  type="email"
                  placeholder="staff@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {editing ? t('staff.passwordEditLabel') : t('staff.passwordLabel')}
                </label>
                <Input
                  type="password"
                  placeholder={editing ? t('staff.passwordEditPlaceholder') : t('staff.passwordPlaceholder')}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('staff.roleLabel')} *
                </label>
                <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
                  <SelectTrigger className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none">
                    <SelectValue placeholder={t('staff.selectRole')} />
                  </SelectTrigger>
                  <SelectContent className="border-slate-200 bg-white p-1 mt-1 shadow-lg rounded-xl">
                    <SelectItem value="cashier" className="rounded-md p-1 text-sm text-slate-700 focus:bg-slate-100">{t('staff.roleCashier')}</SelectItem>
                    <SelectItem value="manager" className="rounded-md p-1 text-sm text-slate-700 focus:bg-slate-100">{t('staff.roleManager')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1.5">{t('staff.roleHint')}</p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Security Question (for password reset)</p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">Choose a question</label>
                    <div className="relative">
                      <select
                        value={form.security_question}
                        onChange={(e) => setForm({ ...form, security_question: e.target.value })}
                        className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-10 text-sm text-slate-900 shadow-sm transition-all outline-none hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
                      >
                        <option value="" disabled>Select a security question</option>
                        {SECURITY_QUESTIONS.map((q) => (
                          <option key={q} value={q}>{q}</option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">Your answer</label>
                    <input
                      type="text"
                      value={form.security_answer}
                      onChange={(e) => setForm({ ...form, security_answer: e.target.value })}
                      placeholder="Enter the answer"
                      className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-4 flex justify-between gap-3 bg-white">
              {editing && (
                <Button variant="outline" onClick={() => handleDelete(editing.user_uuid)} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                  <HugeiconsIcon icon={Delete01Icon} className="text-lg mr-1"  />
                  {t('staff.deleteTitle')}
                </Button>
              )}
              <div className="flex gap-3 ml-auto">
                <Button variant="outline" onClick={() => { setModalOpen(false); resetForm(); }} className="border-slate-300 text-slate-700 hover:bg-slate-100">
                  {t('common.cancel')}
                </Button>
                <Button
                  onClick={editing ? handleUpdate : handleCreate}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-900/20"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      {editing ? t('staff.updating') : t('staff.creating')}
                    </span>
                  ) : (
                    editing ? t('staff.updateButton') : t('staff.createButton')
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedStat && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setSelectedStat(null)}>
          <div className="w-[min(90vw,400px)] h-[min(80vh,500px)] rounded-[24px] overflow-hidden pt-5 px-5 pb-3 flex flex-col" style={{ background: "#1a1d1f" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-1">
              <button onClick={() => setSelectedStat(null)} className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: "#dc2626", color: "#fff" }}>
                Close
              </button>
            </div>

            {selectedStat === 'total' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Total Staff</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{totalStaff.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8b5cf6", color: "#fff" }}>
                    All Employees
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.total} width={400} height={180} color="#8b5cf6" />
                </div>
              </>
            )}

            {selectedStat === 'mgr' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Managers</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{managers.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    Manager Role
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.mgr} width={400} height={180} color="#3b82f6" />
                </div>
              </>
            )}

            {selectedStat === 'cash' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>Cashiers</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{cashiers.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#10b981", color: "#fff" }}>
                    Cashier Role
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.cash} width={400} height={180} color="#10b981" />
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
