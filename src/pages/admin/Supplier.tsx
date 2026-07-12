import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type Supplier,
} from "../../renderer/services/supplierApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete01Icon,
  Search01Icon,
  Cancel01Icon,
  UserGroupIcon,
  CallIcon,
  Mail01Icon,
  Location01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";

// shadcn/ui components
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function SupplierPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Add supplier form
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // Edit supplier
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});

  const [error, setError] = useState<string | null>(null);
  const [pageS, setPageS] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Supplier load error:", e);
      setError(t('suppliers.loadError'));
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError(t('suppliers.nameRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supplierData = {
        name: form.name.trim(),
        phone: form.phone?.trim() || "",
        email: form.email?.trim() || "",
        address: form.address?.trim() || "",
      };

      await createSupplier(supplierData);
      await loadSuppliers();
      setForm({ name: "", phone: "", email: "", address: "" });
      setAddDialogOpen(false);
    } catch (e) {
      console.error("Create supplier error:", e);
      setError(e instanceof Error ? e.message : t('suppliers.createError'));
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (s: Supplier) => {
    setEditingId(s.supplier_uuid);
    setEditForm({
      name: s.name || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
    });
  };

  const handleUpdate = async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const updateData = {
        name: editForm.name?.trim(),
        phone: editForm.phone?.trim() || "",
        email: editForm.email?.trim() || "",
        address: editForm.address?.trim() || "",
      };

      await updateSupplier(id, updateData);
      await loadSuppliers();
      setEditingId(null);
      setEditForm({});
    } catch (e) {
      console.error("Update supplier error:", e);
      setError(e instanceof Error ? e.message : t('suppliers.updateError'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('suppliers.deleteConfirm'))) return;

    setLoading(true);
    setError(null);

    try {
      await deleteSupplier(id);
      await loadSuppliers();
    } catch (e) {
      console.error("Delete supplier error:", e);
      setError(e instanceof Error ? e.message : t('suppliers.deleteError'));
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) =>
    s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.phone?.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredSuppliers.length / pageSize);
  const paginatedSuppliers = filteredSuppliers.slice((pageS - 1) * pageSize, pageS * pageSize);

  useEffect(() => {
    setPageS(1);
  }, [searchTerm]);

  const totalSuppliers = suppliers.length;
  const suppliersWithEmail = suppliers.filter((s) => s.email && s.email.trim()).length;
  const suppliersWithPhone = suppliers.filter((s) => s.phone && s.phone.trim()).length;

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
      total: gen(totalSuppliers),
      email: gen(suppliersWithEmail),
      phone: gen(suppliersWithPhone),
    };
  }, [totalSuppliers, suppliersWithEmail, suppliersWithPhone]);

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
      {/* Custom Add Supplier Modal */}
      {addDialogOpen && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{t('suppliers.addNewSupplier')}</h2>
              <button onClick={() => setAddDialogOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.supplierNameRequired')}
                </label>
                <Input
                  placeholder={t('suppliers.namePlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.phoneLabel')}
                </label>
                <Input
                  placeholder={t('suppliers.phonePlaceholder')}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.emailLabel')}
                </label>
                <Input
                  type="email"
                  placeholder={t('suppliers.emailPlaceholder')}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.addressLabel')}
                </label>
                <Textarea
                  rows={3}
                  placeholder={t('suppliers.addressPlaceholder')}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none resize-none"
                />
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 bg-white">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="border-slate-300 text-slate-700 hover:bg-slate-100">
                {t('common.cancel')}
              </Button>
              <Button onClick={handleCreate} disabled={user?.role !== 'admin' || loading} className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-900/20">
                {loading ? t('suppliers.adding') : t('suppliers.addSupplier')}
              </Button>
            </div>
          </div>
        </div>,
        document.body
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
            <p className="text-xs text-gray-400 mb-0.5">{t('suppliers.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('suppliers.totalSuppliers')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{totalSuppliers.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('email')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('suppliers.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('suppliers.withEmail')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{suppliersWithEmail.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <button onClick={() => setSelectedStat('phone')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17L17 7M7 7h10v10" />
            </svg>
          </button>
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">{t('suppliers.statistics')}</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">{t('suppliers.withPhone')}</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">{suppliersWithPhone.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Search Bar + Add Button */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"  />
          <Input
            placeholder={t('suppliers.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-11 pr-10 py-2.5 bg-white border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
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
        <Button onClick={() => setAddDialogOpen(true)} disabled={user?.role !== 'admin'} className="gap-2 bg-green-500 text-white shrink-0">
          <HugeiconsIcon icon={Add01Icon} className="text-xl"  />
          {t('suppliers.addSupplier')}
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex justify-between items-center">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
              <HugeiconsIcon icon={Cancel01Icon} className="text-lg"  />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Suppliers Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="table-scroll">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-start px-5 py-3 text-xs font-medium text-gray-500">{t('suppliers.tableSupplier')}</th>
              <th className="text-start px-5 py-3 text-xs font-medium text-gray-500">{t('suppliers.tableContact')}</th>
              <th className="text-start px-5 py-3 text-xs font-medium text-gray-500">{t('suppliers.tableAddress')}</th>
              <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('suppliers.tableActions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
                </td>
              </tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-start py-12 text-gray-500">
                  {searchTerm ? t('suppliers.noSearchResults') : t('suppliers.noSuppliers')}
                </td>
              </tr>
            ) : (
              paginatedSuppliers.map((s) => (
                <tr key={s.supplier_uuid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/supplier/${s.supplier_uuid}`)}>
                  <td className="px-5 py-3.5 text-start">
                    <div className="font-medium text-gray-800">{s.name || t('suppliers.unnamed')}</div>
                    {s.supplier_uuid && (
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        {t('suppliers.idLabel')}: {s.supplier_uuid.slice(0, 8)}...
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="space-y-1">
                      {s.phone && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <HugeiconsIcon icon={CallIcon} className="text-xs shrink-0"  />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          <HugeiconsIcon icon={Mail01Icon} className="text-xs shrink-0"  />
                          <span className="truncate max-w-[180px]">{s.email}</span>
                        </div>
                      )}
                      {!s.phone && !s.email && (
                        <span className="text-xs text-gray-400">{t('suppliers.noContactInfo')}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {s.address ? (
                      <div className="flex items-start gap-1 text-sm text-gray-600">
                        <HugeiconsIcon icon={Location01Icon} className="text-xs mt-0.5 shrink-0"  />
                        <span className="line-clamp-2 break-words">{s.address}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{t('suppliers.noAddress')}</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                      disabled={user?.role !== 'admin'}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                      {t('suppliers.editTitle')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {t('suppliers.showing', { start: (pageS - 1) * pageSize + 1, end: Math.min(pageS * pageSize, filteredSuppliers.length), total: filteredSuppliers.length })}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPageS(p => Math.max(1, p - 1))}
                disabled={pageS === 1}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('suppliers.prev')}
              </button>
              {(() => {
                const pages: (number | string)[] = [];
                const range = 2;
                for (let i = 1; i <= totalPages; i++) {
                  if (i === 1 || i === totalPages || (i >= pageS - range && i <= pageS + range)) {
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
                      onClick={() => setPageS(p as number)}
                      className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                        p === pageS
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
                onClick={() => setPageS(p => Math.min(totalPages, p + 1))}
                disabled={pageS === totalPages}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t('suppliers.next')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Edit Supplier Modal */}
      {editingId && createPortal(
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{t('suppliers.editSupplier')}</h2>
              <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.supplierNameRequired')}
                </label>
                <Input
                  placeholder={t('suppliers.namePlaceholder')}
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.phoneLabel')}
                </label>
                <Input
                  placeholder={t('suppliers.phonePlaceholder')}
                  value={editForm.phone || ""}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.emailLabel')}
                </label>
                <Input
                  type="email"
                  placeholder={t('suppliers.emailPlaceholder')}
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-start font-semibold text-slate-700 mb-1.5">
                  {t('suppliers.addressLabel')}
                </label>
                <Textarea
                  rows={3}
                  placeholder={t('suppliers.addressPlaceholder')}
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-green-400 focus:ring-2 focus:ring-green-500/20 transition-all outline-none resize-none"
                />
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-between gap-3 bg-white">
              <Button variant="outline" onClick={() => editingId && handleDelete(editingId)} disabled={user?.role !== 'admin'} className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                <HugeiconsIcon icon={Delete01Icon} className="text-lg mr-1"  />
                {t('suppliers.deleteTitle')}
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditingId(null)} className="border-slate-300 text-slate-700 hover:bg-slate-100">{t('common.cancel')}</Button>
                <Button onClick={() => editingId && handleUpdate(editingId)} disabled={user?.role !== 'admin' || loading} className="bg-green-600 hover:bg-green-700 text-white shadow-md shadow-green-900/20">
                  {loading ? t('suppliers.saving') : t('suppliers.saveChanges')}
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
                {t('common.close')}
              </button>
            </div>

            {selectedStat === 'total' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('suppliers.totalSuppliers')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{totalSuppliers.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#8b5cf6", color: "#fff" }}>
                    {t('suppliers.allSuppliers')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.total} width={400} height={180} color="#8b5cf6" />
                </div>
              </>
            )}

            {selectedStat === 'email' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('suppliers.withEmail')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{suppliersWithEmail.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#10b981", color: "#fff" }}>
                    {t('suppliers.emailRegistered')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.email} width={400} height={180} color="#10b981" />
                </div>
              </>
            )}

            {selectedStat === 'phone' && (
              <>
                <div className="flex-1 flex flex-col justify-center text-center px-4">
                  <p className="text-base" style={{ color: "#888888" }}>{t('suppliers.withPhone')}</p>
                  <p className="text-5xl font-bold leading-none tracking-tight text-white mt-3">{suppliersWithPhone.toLocaleString()}</p>
                  <span className="inline-block text-sm font-semibold px-4 py-1.5 rounded-full mt-3 mx-auto" style={{ background: "#3b82f6", color: "#fff" }}>
                    {t('suppliers.phoneRegistered')}
                  </span>
                </div>
                <div className="relative -mx-5 -mb-3" style={{ height: 180 }}>
                  <Sparkline data={trendData.phone} width={400} height={180} color="#3b82f6" />
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
