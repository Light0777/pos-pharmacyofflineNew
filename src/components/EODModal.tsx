import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  PrinterIcon,
  RefreshIcon,
  MoonIcon,
  ReceiptTextIcon,
  CreditCardIcon,
  ShoppingBag01Icon,
  File01Icon,
  ChartUpIcon,
  CubeIcon,
  Time01Icon,
  CheckmarkCircle01Icon,
} from "@hugeicons/core-free-icons";
import { IndianRupee } from "./IndianRupee";
import { getDailyReport } from "../renderer/services/reportApi";

export default function EODModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getDailyReport(today);
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n || 0);

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case "cash":
        return t("eodModal.paymentMethods.cash");
      case "upi":
        return t("eodModal.paymentMethods.upi");
      case "card":
        return t("eodModal.paymentMethods.card");
      case "pay_later":
        return t("eodModal.paymentMethods.payLater");
      default:
        return method;
    }
  };

  const paymentIcons: Record<string, React.ReactNode> = {
    cash: <IndianRupee className="text-sm" />,
    upi: <HugeiconsIcon icon={File01Icon} className="text-sm"  />,
    card: <HugeiconsIcon icon={CreditCardIcon} className="text-sm"  />,
    pay_later: <HugeiconsIcon icon={ShoppingBag01Icon} className="text-sm"  />,
  };

  const paymentColors: Record<string, string> = {
    cash: "from-green-500 to-emerald-600",
    upi: "from-blue-500 to-indigo-600",
    card: "from-purple-500 to-violet-600",
    pay_later: "from-amber-500 to-orange-600",
  };

  const paymentBg: Record<string, string> = {
    cash: "bg-green-50 border-green-200",
    upi: "bg-blue-50 border-blue-200",
    card: "bg-purple-50 border-purple-200",
    pay_later: "bg-amber-50 border-amber-200",
  };

  const totalCollected = report?.payments?.reduce(
    (s: number, p: any) => s + p.total,
    0
  );

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 print:hidden-overlay"
      style={{
        background: visible
          ? "rgba(15, 23, 42, 0.7)"
          : "rgba(15, 23, 42, 0)",
        backdropFilter: visible ? "blur(8px)" : "blur(0px)",
        transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        id="eod-modal"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? "translateY(0) scale(1)"
            : "translateY(30px) scale(0.96)",
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white flex-shrink-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(34,197,94,0.2) 0%, transparent 50%)",
            }}
          />
          <div className="relative flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur-sm">
                <HugeiconsIcon icon={MoonIcon} className="text-2xl"  />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {t("eodModal.title")}
                </h2>
                <p className="text-slate-300 text-sm mt-0.5 font-medium">
                  {new Date().toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={load}
                className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95"
                title={t("settings.refresh")}
              >
                <HugeiconsIcon icon={RefreshIcon} className="text-lg"  />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="text-xl"  />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-80">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-slate-200 border-t-emerald-500" />
              <p className="text-sm text-slate-400 font-medium">
                {t("common.loading")}
              </p>
            </div>
          </div>
        ) : !report ? (
          <div className="flex items-center justify-center h-80 text-slate-400">
            <div className="text-center">
              <HugeiconsIcon icon={ReceiptTextIcon}
                className="text-5xl mb-3 opacity-30"
               />
              <p>{t("eodModal.noData")}</p>
            </div>
          </div>
        ) : (
          <div
            ref={contentRef}
            className="overflow-y-auto flex-1 p-5 space-y-5"
            id="eod-content"
          >
            {/* Shop name for print */}
            <div className="hidden print:block text-center mb-2">
              <p className="font-bold text-lg">
                {report.shop?.name || t("eodModal.myStore")}
              </p>
              <p className="text-sm text-gray-500">
                {t("eodModal.printSubtitle")} — {today}
              </p>
            </div>

            {/* Key Numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-2xl p-4 border border-slate-200/60 overflow-hidden">
                <div className="absolute top-3 right-3 text-slate-300">
                  <HugeiconsIcon icon={ReceiptTextIcon} className="text-xl"  />
                </div>
                <p className="text-3xl font-bold text-slate-800 tracking-tight">
                  {report.summary.total_bills}
                </p>
                <p className="text-xs font-medium text-slate-500 mt-1.5 uppercase tracking-wider">
                  {t("eodModal.billsGenerated")}
                </p>
              </div>
              <div className="relative bg-gradient-to-br from-emerald-50 to-green-50/50 rounded-2xl p-4 border border-emerald-200/60 overflow-hidden">
                <div className="absolute top-3 right-3 text-emerald-300">
                  <HugeiconsIcon icon={ChartUpIcon} className="text-xl"  />
                </div>
                <p className="text-3xl font-bold text-emerald-700 tracking-tight">
                  ₹{fmt(report.summary.grand_total)}
                </p>
                <p className="text-xs font-medium text-emerald-600 mt-1.5 uppercase tracking-wider">
                  {t("eodModal.totalSales")}
                </p>
              </div>
              <div className="relative bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl p-4 border border-blue-200/60 overflow-hidden">
                <div className="absolute top-3 right-3 text-blue-300">
                  <IndianRupee className="text-xl" />
                </div>
                <p className="text-3xl font-bold text-blue-700 tracking-tight">
                  ₹{fmt(report.summary.subtotal)}
                </p>
                <p className="text-xs font-medium text-blue-600 mt-1.5 uppercase tracking-wider">
                  {t("eodModal.subtotal")}
                </p>
              </div>
              <div className="relative bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl p-4 border border-amber-200/60 overflow-hidden">
                <div className="absolute top-3 right-3 text-amber-300">
                  <HugeiconsIcon icon={ReceiptTextIcon} className="text-xl"  />
                </div>
                <p className="text-3xl font-bold text-amber-700 tracking-tight">
                  ₹{fmt(report.summary.total_tax)}
                </p>
                <p className="text-xs font-medium text-amber-600 mt-1.5 uppercase tracking-wider">
                  {t("eodModal.gstCollected")}
                </p>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-5 border border-slate-200/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                  {t("eodModal.paymentBreakdown")}
                </h3>
              </div>
              {report.payments.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-4">
                  {t("eodModal.noPayments")}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {report.payments.map((p: any, i: number) => (
                    <div
                      key={i}
                      className={`flex justify-between items-center p-3 rounded-xl border ${paymentBg[p.method] || "bg-slate-50 border-slate-200"}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${paymentColors[p.method] || "from-slate-500 to-slate-600"} text-white`}
                        >
                          {paymentIcons[p.method] || <IndianRupee className="text-sm" />}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">
                          {getPaymentLabel(p.method)}
                        </span>
                      </div>
                      <span className="font-bold text-slate-800">
                        ₹{fmt(p.total)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-200/50 mt-3">
                    <div className="flex items-center gap-2.5">
                      <HugeiconsIcon icon={CheckmarkCircle01Icon}
                        className="text-lg text-emerald-200"
                       />
                      <span className="font-semibold text-sm uppercase tracking-wider">
                        {t("eodModal.totalCollected")}
                      </span>
                    </div>
                    <span className="font-bold text-lg tracking-tight">
                      ₹{fmt(totalCollected)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Top 5 Products */}
            {report.top_products.length > 0 && (
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-5 border border-slate-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-violet-500 rounded-full" />
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    {t("eodModal.topProducts")}
                  </h3>
                </div>
                <div className="space-y-2">
                  {report.top_products.slice(0, 5).map((p: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-center p-3 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            i === 0
                              ? "bg-amber-100 text-amber-700"
                              : i === 1
                                ? "bg-slate-100 text-slate-600"
                                : i === 2
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          {i + 1}
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md font-medium">
                          {t("eodModal.qtyLabel")}: {p.qty_sold}
                        </span>
                        <span className="text-sm font-bold text-emerald-600">
                          ₹{fmt(p.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bills list */}
            {report.bills.length > 0 && (
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-5 border border-slate-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-blue-500 rounded-full" />
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">
                    {t("eodModal.billsHeader", { count: report.bills.length })}
                  </h3>
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {report.bills.map((b: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between items-center px-3.5 py-2.5 rounded-xl bg-white border border-slate-100 hover:border-slate-200 transition-all hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
                          <HugeiconsIcon icon={ReceiptTextIcon} className="text-sm"  />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 font-mono tracking-tight">
                            {b.invoice_number}
                          </p>
                          {b.customer_name && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {b.customer_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-md flex items-center gap-1">
                          <HugeiconsIcon icon={Time01Icon} className="text-[10px]"  />
                          {new Date(b.created_at).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                        <span className="text-sm font-bold text-slate-800">
                          ₹{fmt(b.grand_total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!loading && report && (
          <div className="p-4 border-t border-slate-100 flex gap-3 flex-shrink-0 print:hidden bg-white">
            <button
              onClick={() => window.print()}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-3 rounded-xl font-semibold text-sm shadow-md shadow-emerald-200/50 transition-all active:scale-[0.98]"
            >
              <HugeiconsIcon icon={PrinterIcon} className="text-lg"  />
              {t("eodModal.printSummary")}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98]"
            >
              {t("common.close")}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #eod-content, #eod-content * { visibility: visible; }
          #eod-content { position: absolute; left: 0; top: 0; width: 100%; }
          #eod-modal {
            position: absolute;
            left: 50%;
            top: 0;
            transform: translateX(-50%);
            width: 80mm;
            box-shadow: none;
            border-radius: 0;
          }
          @page { size: A4; margin: 10mm; }
        }
        #eod-content::-webkit-scrollbar { width: 4px; }
        #eod-content::-webkit-scrollbar-track { background: transparent; }
        #eod-content::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>,
    document.body
  );
}
