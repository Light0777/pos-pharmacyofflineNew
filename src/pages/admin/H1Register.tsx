import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { getH1Register, getH1RegisterByDateRange } from "../../renderer/services/h1RegisterApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  Search01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import SimpleDatePicker from "../../components/SimpleDatePicker";

export default function H1Register() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const SCHEDULE_TABS = ["All", "H", "H1", "X"];
  const [scheduleTab, setScheduleTab] = useState("All");
  const [fromPickPos, setFromPickPos] = useState({ top: 0, right: 0 });
  const [toPickPos, setToPickPos] = useState({ top: 0, right: 0 });
  const fromBtnRef = useRef<HTMLButtonElement>(null);
  const toBtnRef = useRef<HTMLButtonElement>(null);

  const loadRecords = async () => {
    setLoading(true);
    try {
      let data: any[];
      if (fromDate && toDate) {
        data = await getH1RegisterByDateRange(
          format(fromDate, "yyyy-MM-dd"),
          format(toDate, "yyyy-MM-dd")
        );
      } else {
        data = await getH1Register();
      }
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load H1 register:", err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    if (fromDate && toDate) {
      loadRecords();
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!showFromPicker || !fromBtnRef.current) return;
    const rect = fromBtnRef.current.getBoundingClientRect();
    setFromPickPos({ top: rect.bottom + 6, right: document.documentElement.clientWidth - rect.right });
    const handleClick = (e: MouseEvent) => {
      if (fromBtnRef.current && !fromBtnRef.current.contains(e.target as Node) && !(e.target as Element)?.closest?.(".cal-card")) {
        setShowFromPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showFromPicker]);

  useEffect(() => {
    if (!showToPicker || !toBtnRef.current) return;
    const rect = toBtnRef.current.getBoundingClientRect();
    setToPickPos({ top: rect.bottom + 6, right: document.documentElement.clientWidth - rect.right });
    const handleClick = (e: MouseEvent) => {
      if (toBtnRef.current && !toBtnRef.current.contains(e.target as Node) && !(e.target as Element)?.closest?.(".cal-card")) {
        setShowToPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showToPicker]);

  const filtered = records.filter((r) =>
    [r.patient_name, r.doctor_name, r.prescription_number, r.product_name]
      .some((f) => f?.toLowerCase().includes(searchTerm.toLowerCase()))
  ).filter((r) => scheduleTab === "All" || r.schedule_type === scheduleTab);
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, fromDate, toDate, scheduleTab]);

  const clearFilters = () => {
    setFromDate(undefined);
    setToDate(undefined);
    loadRecords();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-left">{t('h1Register.title')}</h1>
        <div className="flex gap-1 bg-slate-100 rounded-full p-1 mt-3 w-fit">
          {SCHEDULE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setScheduleTab(tab); setPage(1); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                scheduleTab === tab
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab === "All" ? "All" : `Schedule ${tab}`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"  />
          <Input
            placeholder={t('h1Register.searchPlaceholder')}
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
        <div className="relative shrink-0">
          <button
            ref={fromBtnRef}
            type="button"
            onClick={() => setShowFromPicker(!showFromPicker)}
            className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors"
          >
            <CalendarIcon className="w-4 h-4 text-slate-400" />
            <span>{fromDate ? format(fromDate, "dd MMM yyyy") : t('h1Register.from')}</span>
          </button>
          {fromDate && (
            <button
              onClick={() => setFromDate(undefined)}
              className="absolute -right-2 -top-2 w-5 h-5 bg-slate-300 hover:bg-slate-400 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {showFromPicker && (
            <div className="fixed z-[70]" style={{ top: fromPickPos.top, right: fromPickPos.right }}>
              <SimpleDatePicker
                date={fromDate || new Date()}
                onSelect={(d) => { setFromDate(d); setShowFromPicker(false); }}
              />
            </div>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            ref={toBtnRef}
            type="button"
            onClick={() => setShowToPicker(!showToPicker)}
            className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors"
          >
            <CalendarIcon className="w-4 h-4 text-slate-400" />
            <span>{toDate ? format(toDate, "dd MMM yyyy") : t('h1Register.to')}</span>
          </button>
          {toDate && (
            <button
              onClick={() => setToDate(undefined)}
              className="absolute -right-2 -top-2 w-5 h-5 bg-slate-300 hover:bg-slate-400 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {showToPicker && (
            <div className="fixed z-[70]" style={{ top: toPickPos.top, right: toPickPos.right }}>
              <SimpleDatePicker
                date={toDate || new Date()}
                onSelect={(d) => { setToDate(d); setShowToPicker(false); }}
              />
            </div>
          )}
        </div>
        {(fromDate || toDate) && (
          <Button variant="ghost" onClick={clearFilters} className="text-slate-500 shrink-0">
            {t('h1Register.clear')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-12">
          {searchTerm ? t('h1Register.noResults', { term: searchTerm }) : t('h1Register.noEntries')}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="table-scroll"><table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.date')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.patient')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.age')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.gender')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.doctor')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.license')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.prescription')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.qty')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('h1Register.pharmacist')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((r: any) => (
                <tr key={r.register_uuid || r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 text-slate-600 text-xs font-mono">
                    {new Date(r.created_at).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{r.patient_name}</td>
                  <td className="px-5 py-3.5 text-slate-600">{r.patient_age ? `${r.patient_age}y` : "-"}</td>
                  <td className="px-5 py-3.5">
                    {r.patient_gender ? (
                      <Badge variant="outline" className="text-[10px]">
                        {r.patient_gender}
                      </Badge>
                    ) : "-"}
                  </td>
                  <td className="px-5 py-3.5 text-slate-700">{r.doctor_name}</td>
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-500">{r.doctor_license || "-"}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-700">{r.prescription_number}</td>
                  <td className="px-5 py-3.5 text-center font-semibold">{r.quantity}</td>
                  <td className="px-5 py-3.5 text-slate-600">{r.pharmacist_name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
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
    </div>
  );
}
