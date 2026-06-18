import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getAuditLogs } from "../../renderer/services/auditLogApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Search01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ACTION_BADGES: Record<string, string> = {
  sale_created: "default",
  sale_updated: "secondary",
  schedule_h1_sale: "outline",
  schedule_x_sale: "destructive",
  batch_quarantined: "destructive",
};

export default function AuditLogs() {
  const { t } = useTranslation();
  const ACTION_LABELS: Record<string, string> = {
    sale_created: t('auditLog.actionSaleCreated'),
    sale_updated: t('auditLog.actionSaleUpdated'),
    schedule_h1_sale: t('auditLog.actionH1Sale'),
    schedule_x_sale: t('auditLog.actionScheduleXSale'),
    batch_quarantined: t('auditLog.actionBatchQuarantined'),
  };
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [selected, setSelected] = useState<any | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load audit logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((l) =>
    [l.action_type, l.entity_type, l.details, l.user_name, l.audit_uuid]
      .some((f) => f?.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const getActionIcon = (action: string) => {
    if (action?.includes("quarantine")) return Alert01Icon;
    if (action?.includes("created")) return CheckmarkCircle01Icon;
    return InformationCircleIcon;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight text-left">{t('auditLog.title')}</h1>
      </div>

      <div className="relative flex-1">
        <HugeiconsIcon icon={Search01Icon} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg"  />
        <Input
          placeholder={t('auditLog.searchPlaceholder')}
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

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-12">
          {searchTerm ? t('auditLog.noResults', { term: searchTerm }) : t('auditLog.noEntries')}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="table-scroll">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('auditLog.timestamp')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('auditLog.schedule')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('auditLog.entity')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('auditLog.user')}</th>
                <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t('auditLog.details')}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((log: any) => (
                <tr key={log.audit_uuid || log.id} onClick={() => setSelected(log)} className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer">
                  <td className="px-5 py-3.5 text-xs font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5">
                      <Badge variant={(ACTION_BADGES[log.action_type] || "default") as any} className={`gap-1 ${log.action_type === "schedule_h1_sale" ? "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100" : log.action_type === "sale_created" ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" : log.action_type === "sale_updated" ? "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" : ""}`}>
                        <HugeiconsIcon icon={getActionIcon(log.action_type)} className="text-xs"  />
                        {ACTION_LABELS[log.action_type] || log.action_type}
                      </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 text-sm">
                    {log.entity_type}
                    {log.entity_uuid && (
                      <span className="text-xs font-mono text-slate-400 ml-1">({log.entity_uuid.slice(0, 8)}...)</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-slate-600">{log.user_name || log.user_uuid?.slice(0, 8) || "-"}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-600 max-w-[300px] truncate" title={log.details || ""}>
                    {log.details || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      {selected && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{t('auditLog.auditLogDetails')}</h2>
                <p className="text-slate-400 text-sm mt-1 text-left">#{selected.audit_uuid?.slice(0, 8).toUpperCase() || t('auditLog.na')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
                <h3 className="font-semibold text-slate-700 text-sm">{t('auditLog.eventInfo')}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{t('auditLog.action')}</span>
                  <Badge variant={(ACTION_BADGES[selected.action_type] || "default") as any} className={`gap-1 text-xs ${selected.action_type === "schedule_h1_sale" ? "bg-amber-100 text-amber-700 border-amber-200" : selected.action_type === "sale_created" ? "bg-green-100 text-green-700 border-green-200" : selected.action_type === "sale_updated" ? "bg-blue-100 text-blue-700 border-blue-200" : ""}`}>
                    <HugeiconsIcon icon={getActionIcon(selected.action_type)} className="text-xs"  />
                    {ACTION_LABELS[selected.action_type] || selected.action_type}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{t('auditLog.timestamp')}</span>
                  <span className="text-sm font-medium text-slate-700">{new Date(selected.created_at).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{t('auditLog.entity')}</span>
                  <span className="text-sm font-medium text-slate-700">{selected.entity_type}</span>
                </div>
                {selected.entity_uuid && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-20 shrink-0">{t('auditLog.entityId')}</span>
                    <span className="text-sm font-mono text-slate-600">{selected.entity_uuid}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
                <h3 className="font-semibold text-slate-700 text-sm">{t('auditLog.userInfo')}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-20 shrink-0">{t('auditLog.user')}</span>
                  <span className="text-sm font-medium text-slate-700">{selected.user_name || "-"}</span>
                </div>
                {selected.user_uuid && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-20 shrink-0">{t('auditLog.userId')}</span>
                    <span className="text-sm font-mono text-slate-600">{selected.user_uuid}</span>
                  </div>
                )}
                {selected.ip_address && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-20 shrink-0">{t('auditLog.ipAddress')}</span>
                    <span className="text-sm font-mono text-slate-600">{selected.ip_address}</span>
                  </div>
                )}
              </div>

              {selected.details && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-2 text-sm">{t('auditLog.details')}</h3>
                  <p className="text-sm text-slate-600 whitespace-pre-wrap break-words font-mono">{selected.details}</p>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 rounded-b-2xl">
              <button onClick={() => setSelected(null)} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-xl transition-colors text-sm">
                {t('auditLog.close')}
              </button>
            </div>
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
