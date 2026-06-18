import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, differenceInCalendarDays } from "date-fns";
import { getDailyReport, getGSTReport, getGSTReportByRange } from "../../renderer/services/reportApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudDownloadIcon,
  PrinterIcon,
} from "@hugeicons/core-free-icons";
import * as XLSX from "xlsx";
import DateRangePicker from "@/components/DateRangePicker";
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from "chart.js";
Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

// shadcn/ui components
import { Button } from "@/components/ui/button";

type ViewMode = "daily" | "monthly" | "yearly" | "range";

function dateKey(d: Date) {
    return format(d, "yyyy-MM-dd");
}

// ── GST Slab Donut Chart ──────────────────────────────────
const GstSlabDonut = ({ slabs, totalTaxable }: { slabs: any[]; totalTaxable: number }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<Chart<"doughnut"> | null>(null);

    useEffect(() => {
        if (!canvasRef.current || !slabs?.length) return;
        if (chartRef.current) { chartRef.current.destroy(); }
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        const labels = slabs.map((s: any) => `${s.tax_percent}% GST`);
        const data = slabs.map((s: any) => s.taxable_value);
        const colors = [
            "rgba(255, 255, 255, 0.95)",
            "rgba(200, 198, 230, 0.85)",
            "rgba(160, 158, 210, 0.75)",
            "rgba(130, 128, 195, 0.65)",
            "rgba(100, 98, 180, 0.55)",
        ];
        chartRef.current = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, slabs.length),
                    borderColor: "rgba(106, 104, 220, 0.4)",
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: "58%",
                rotation: -20,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx: any) => ` ${ctx.label}: ₹${Number(ctx.parsed).toLocaleString("en-IN")}`,
                        },
                        backgroundColor: "rgba(30, 28, 80, 0.9)",
                        titleColor: "#fff",
                        bodyColor: "rgba(255,255,255,0.8)",
                        borderColor: "rgba(255,255,255,0.15)",
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8,
                    },
                },
                animation: { duration: 900, easing: "easeInOutQuart" },
                layout: { padding: 8 },
            },
        });
        return () => { if (chartRef.current) chartRef.current.destroy(); };
    }, [slabs]);

    return (
        <div className="relative rounded-2xl overflow-hidden p-5 shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.06)] flex flex-col h-full"
             style={{ background: "linear-gradient(145deg, #6b68e0 0%, #5b5bc8 40%, #4a4ab0 100%)" }}>
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
                 style={{ background: "radial-gradient(circle at 70% 20%, rgba(255,255,255,0.12) 0%, transparent 60%)" }} />
            <div className="flex items-center gap-2 mb-3 relative z-10">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" stroke="white" strokeWidth="2" />
                        <path d="M12 2a10 10 0 0 1 10 10H12V2z" fill="white" opacity="0.9" />
                    </svg>
                </div>
                <span className="text-white font-semibold text-sm tracking-tight">GST Slab Distribution</span>
            </div>
            <div className="flex items-center justify-center relative z-10 mt-auto pb-1 w-full">
                {slabs?.length > 0 ? (
                    <div className="relative w-full max-w-[320px] aspect-square">
                        <canvas ref={canvasRef} className="w-full h-full" />
                    </div>
                ) : (
                    <div className="text-white/50 text-sm text-center py-10">No GST slab data</div>
                )}
            </div>
        </div>
    );
};

export default function GSTReport() {
    const { t } = useTranslation();
    const [rangeStart, setRangeStart] = useState<Date | null>(null);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const [invoicePage, setInvoicePage] = useState(1);
    const [slabPage, setSlabPage] = useState(1);
    const [chartHoverIdx, setChartHoverIdx] = useState<number | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Determine view mode from the selected range
    const viewMode: ViewMode = (() => {
        if (!rangeStart) return "monthly";
        if (!rangeEnd || dateKey(rangeStart) === dateKey(rangeEnd)) return "daily";
        const s = dateKey(rangeStart);
        const e = dateKey(rangeEnd);
        // Check if it spans a full month
        const monthStart = format(rangeStart, "yyyy-MM-01");
        const monthEnd = format(endOfMonth(rangeStart), "yyyy-MM-dd");
        if (s === monthStart && e === monthEnd) return "monthly";
        // Check if it spans a full year
        const yearStart = format(rangeStart, "yyyy-01-01");
        const yearEnd = format(rangeStart, "yyyy-12-31");
        if (s === yearStart && e === yearEnd) return "yearly";
        return "range";
    })();

    const load = useCallback(async () => {
        if (!rangeStart) return;
        setLoading(true);
        setReport(null);
        try {
            if (viewMode === "daily") {
                const d = dateKey(rangeEnd || rangeStart);
                const data = await getDailyReport(d);
                setReport(data);
            } else if (viewMode === "monthly") {
                const m = format(rangeStart, "yyyy-MM");
                const data = await getGSTReport(m);
                setReport(data);
            } else {
                const s = dateKey(rangeStart);
                const e = dateKey(rangeEnd!);
                const data = await getGSTReportByRange(s, e);
                setReport(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [rangeStart, rangeEnd, viewMode]);

    // Pagination for invoice list
    const perPage = 9;
    const totalInvoices = report?.invoices?.length ?? 0;
    const totalInvoicePages = Math.max(1, Math.ceil(totalInvoices / perPage));
    const safeInvoicePage = Math.min(invoicePage, totalInvoicePages);
    const invStart = (safeInvoicePage - 1) * perPage;
    const sortedInvoices = [...(report?.invoices ?? [])].reverse();
    const pageInvoices = sortedInvoices.slice(invStart, invStart + perPage) ?? [];

    useEffect(() => {
        if (rangeStart) load();
    }, [load]);

    // Reset pages when report data changes
    useEffect(() => {
        setInvoicePage(1);
        setSlabPage(1);
        setChartHoverIdx(null);
    }, [report]);

    // Default to current month on mount
    useEffect(() => {
        if (!rangeStart) {
            const now = new Date();
            setRangeStart(startOfMonth(now));
            setRangeEnd(endOfMonth(now));
        }
    }, []);

    const handleRangeChange = (start: Date | null, end: Date | null) => {
        setRangeStart(start);
        setRangeEnd(end);
    };

    const handleMonthSelect = (month: Date) => {
        setRangeStart(startOfMonth(month));
        setRangeEnd(endOfMonth(month));
    };

    const handleYearSelect = (year: Date) => {
        setRangeStart(startOfYear(year));
        setRangeEnd(endOfYear(year));
    };

    const fmt = (n: number) =>
        new Intl.NumberFormat("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(n || 0);

    const displayLabel = (() => {
        if (!rangeStart) return "";
        if (!rangeEnd || dateKey(rangeStart) === dateKey(rangeEnd)) {
            return format(rangeStart, "dd MMM yyyy");
        }
        if (viewMode === "yearly") return format(rangeStart, "yyyy");
        if (viewMode === "monthly") return format(rangeStart, "MMMM yyyy");
        return `${format(rangeStart, "dd MMM yyyy")} - ${format(rangeEnd, "dd MMM yyyy")}`;
    })();

    const getPaymentLabel = (method: string) => {
        switch (method) {
            case "cash":
                return t("dailyReport.paymentMethods.cash");
            case "upi":
                return t("dailyReport.paymentMethods.upi");
            case "card":
                return t("dailyReport.paymentMethods.card");
            case "pay_later":
                return t("dailyReport.paymentMethods.payLater");
            default:
                return method;
        }
    };

    const handleExcelDownload = () => {
        if (!report || !rangeStart) return;
        const wb = XLSX.utils.book_new();
        const title = displayLabel;

        const slabRows = [
            ["GST Report — " + title],
            [t("gstReport.shopLabel") + ": " + (report.shop?.name || "N/A")],
            [t("gstReport.gstinLabel") + ": " + (report.shop?.gstin || "N/A")],
            [],
            [t("gstReport.slabSummaryHeader")],
            [
                t("gstReport.taxRateHeader"),
                t("gstReport.invoicesHeader"),
                t("gstReport.taxableValueHeader"),
                t("gstReport.cgstHeader"),
                t("gstReport.sgstHeader"),
                t("gstReport.totalTaxHeader"),
            ],
            ...(report.slabs || []).map((s: any) => [
                s.tax_percent + "%",
                s.invoice_count,
                s.taxable_value?.toFixed(2),
                (s.total_tax / 2)?.toFixed(2),
                (s.total_tax / 2)?.toFixed(2),
                s.total_tax?.toFixed(2),
            ]),
            [],
            (() => {
                const slabInvSum = (report.slabs || []).reduce((s: number, sl: any) => s + sl.invoice_count, 0);
                const slabTaxSum = (report.slabs || []).reduce((s: number, sl: any) => s + sl.taxable_value, 0);
                const ei = (report.summary?.total_invoices || 0) - slabInvSum;
                const ev = (report.summary?.total_taxable || 0) - slabTaxSum;
                return [t("gstReport.exemptZeroRated"), ei || "", ev?.toFixed(2), 0, 0, 0];
            })(),
            [],
            [
                `${t("gstReport.totalLabel")} (${report.summary?.total_invoices || 0} ${t("gstReport.billsUnit")})`,
                "",
                report.summary?.total_taxable?.toFixed(2),
                ((report.summary?.total_tax || 0) / 2)?.toFixed(2),
                ((report.summary?.total_tax || 0) / 2)?.toFixed(2),
                report.summary?.total_tax?.toFixed(2),
            ],
        ];
        const ws1 = XLSX.utils.aoa_to_sheet(slabRows);
        ws1["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws1, "GST Summary");

        const invoiceRows = [
            ["Invoices — " + title],
            [],
            [
                t("gstReport.invoiceNoHeader"),
                t("gstReport.dateHeader"),
                t("gstReport.customerHeader"),
                t("gstReport.taxableValueHeader"),
                t("gstReport.taxHeader"),
                t("gstReport.grandTotalHeader"),
            ],
            ...(report.invoices || []).map((inv: any) => [
                inv.invoice_number,
                new Date(inv.created_at).toLocaleDateString("en-IN"),
                inv.customer_name || t("gstReport.walkInCustomer"),
                inv.total?.toFixed(2),
                inv.tax?.toFixed(2),
                inv.grand_total?.toFixed(2),
            ]),
        ];
        const ws2 = XLSX.utils.aoa_to_sheet(invoiceRows);
        ws2["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Invoices");

        XLSX.writeFile(wb, `GST_Report_${displayLabel.replace(/[/\\?*\[\]:]/g, "-")}.xlsx`);
    };

    // ─── Daily View ────────────────────────────────────────────
    const renderDailyView = () => {
        if (!report) {
            return <div className="text-center text-slate-500 py-20">{t("dailyReport.noData")}</div>;
        }

        const totalCollected = report.payments?.reduce((s: number, p: any) => s + p.total, 0) || 0;

        return (
            <div ref={printRef} className="space-y-5">
                <div className="hidden print:block text-center mb-6">
                    <h2 className="text-xl font-bold">{report.shop?.name || t("dailyReport.myStore")}</h2>
                    {report.shop?.address && <p className="text-sm">{report.shop.address}</p>}
                    {report.shop?.gstin && <p className="text-sm">{t("dailyReport.gstinLabel")}: {report.shop.gstin}</p>}
                    <h3 className="text-lg font-bold mt-3">{t("dailyReport.printTitle")} — {displayLabel}</h3>
                </div>

                {/* Daily Stats Card + Donut + Calendar Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Stats Card */}
                    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.06)]">
                        <div className="px-5 pt-5 pb-4">
                            <div className="text-left">
                                <h2 className="text-base font-semibold text-gray-900">{t("dailyReport.gstCollected")}</h2>
                                <p className="text-2xl font-bold text-amber-600 mt-1.5">₹{fmt(report.summary?.total_tax || 0)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">GST Collected</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 px-5 pb-4">
                            <div className="bg-gray-50 rounded-xl px-4 py-3.5">
                                <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-gray-400 mb-1">{t("dailyReport.subtotal")}</div>
                                <div className="text-xl font-bold text-gray-900 tracking-tight">₹{fmt(report.summary?.subtotal || 0)}</div>
                            </div>
                            <div className="bg-gray-50 rounded-xl px-4 py-3.5">
                                <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-gray-400 mb-1">{t("dailyReport.totalBills")}</div>
                                <div className="text-xl font-bold text-gray-900 tracking-tight">{report.summary?.total_bills || 0}</div>
                            </div>
                        </div>
                        <div className="h-px bg-gray-100 mx-5" />
                        <div className="px-5 pt-4 pb-3">
                            <div className="flex items-baseline gap-2.5 mb-1">
                                <span className="text-2xl font-bold text-gray-900 tracking-tight">₹{fmt((report.summary?.grand_total || 0) - (report.summary?.total_refunds || 0))}</span>
                                <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Total Revenue</span>
                            </div>
                            {(report.summary?.total_refunds || 0) > 0 && (
                              <p className="text-xs text-red-500 mt-0.5">Refunds: -₹{fmt(report.summary.total_refunds)}</p>
                            )}
                            <div className="text-xs text-gray-400">{displayLabel}</div>
                        </div>
                    </div>

                    {/* Donut Chart */}
                    <GstSlabDonut slabs={(report.gst_slabs || []).map((s: any) => ({ ...s, taxable_value: s.taxable_amount || s.taxable_value || 0 }))} totalTaxable={report.summary?.total_taxable || 0} />

                    {/* Calendar */}
                    <div className="w-full [&_.cal-card]:!w-full [&_.cal-card]:max-w-full [&_.cal-card]:h-full [&_.cal-card]:flex [&_.cal-card]:flex-col [&_.days-grid]:flex-1">
                        <DateRangePicker
                            startDate={rangeStart}
                            endDate={rangeEnd}
                            onChange={(start, end) => {
                                handleRangeChange(start, end);
                            }}
                            onMonthSelect={handleMonthSelect}
                            onYearSelect={handleYearSelect}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Payment Breakdown */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-800">{t("dailyReport.paymentBreakdown")}</h3>
                        </div>
                        {(!report.payments || report.payments.length === 0) ? (
                            <div className="px-5 py-8 text-gray-400 text-sm">{t("dailyReport.noPayments")}</div>
                        ) : (
                            <div className="px-5 py-3 space-y-1">
                                {report.payments.map((p: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                                        <span className="text-gray-600 text-sm">{getPaymentLabel(p.method)}</span>
                                        <span className="font-semibold text-gray-800 text-sm">₹{fmt(p.total)}</span>
                                    </div>
                                ))}
                                <div className="flex justify-between items-center pt-2 font-bold text-gray-900 border-t border-gray-200">
                                    <span className="text-sm">{t("dailyReport.totalCollected")}</span>
                                    <span className="text-emerald-600 text-sm">₹{fmt(totalCollected)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* GST Summary */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h3 className="text-sm font-semibold text-gray-800">{t("dailyReport.gstSummary")}</h3>
                        </div>
                        {(!report.gst_slabs || report.gst_slabs.length === 0) ? (
                            <div className="px-5 py-8 text-gray-400 text-sm">{t("dailyReport.noGst")}</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.slabHeader")}</th>
                                            <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.taxableAmtHeader")}</th>
                                            <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.cgstHeader")}</th>
                                            <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.sgstHeader")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {report.gst_slabs.map((g: any, i: number) => (
                                            <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                <td className="px-5 py-3.5 font-semibold text-gray-800 text-center">{g.tax_percent}%</td>
                                                <td className="px-5 py-3.5 text-gray-700 text-center">₹{fmt(g.taxable_amount)}</td>
                                                <td className="px-5 py-3.5 text-blue-600 text-center">₹{fmt(g.tax_collected / 2)}</td>
                                                <td className="px-5 py-3.5 text-blue-600 text-center">₹{fmt(g.tax_collected / 2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800">{t("dailyReport.topProducts")}</h3>
                    </div>
                    {(!report.top_products || report.top_products.length === 0) ? (
                        <div className="px-5 py-8 text-gray-400 text-sm">{t("dailyReport.noSales")}</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">#</th>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.productHeader")}</th>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.qtySoldHeader")}</th>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.revenueHeader")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.top_products.map((p: any, i: number) => (
                                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3.5 text-gray-400 text-center">{i + 1}</td>
                                            <td className="px-5 py-3.5 font-medium text-gray-800 text-center">{p.name}</td>
                                            <td className="px-5 py-3.5 text-gray-600 text-center">{p.qty_sold}</td>
                                            <td className="px-5 py-3.5 font-semibold text-emerald-600 text-center">₹{fmt(p.revenue)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 text-left">
                        <h3 className="text-sm font-semibold text-gray-800">{t("dailyReport.billsHeader", { count: report.bills?.length || 0 })}</h3>
                    </div>
                    {(!report.bills || report.bills.length === 0) ? (
                        <div className="px-5 py-8 text-gray-400 text-sm">{t("dailyReport.noBills")}</div>
                    ) : (
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                    <tr>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.invoiceHeader")}</th>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.customerHeader")}</th>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.timeHeader")}</th>
                                        <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("dailyReport.amountHeader")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {report.bills.map((b: any, i: number) => (
                                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3.5 font-mono text-blue-600 text-center">#{b.invoice_number}</td>
                                            <td className="px-5 py-3.5 text-gray-800 text-center">{b.customer_name || t("dailyReport.walkInCustomer")}</td>
                                            <td className="px-5 py-3.5 text-gray-500 text-center">
                                                {new Date(b.created_at).toLocaleTimeString("en-IN", {
                                                    hour: "2-digit", minute: "2-digit", hour12: true,
                                                })}
                                            </td>
                                            <td className="px-5 py-3.5 font-semibold text-gray-800 text-center">₹{fmt(b.grand_total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ─── Monthly / Range View ──────────────────────────────────
    const renderMonthlyView = () => {
        if (!report) {
            return (
                <div className="text-center py-20 text-gray-400 text-sm">{t("gstReport.noData")}</div>
            );
        }
        // Derive exempt values as the remainder after accounting for all GST slabs
        const slabInvoiceSum = (report.slabs || []).reduce((s: number, sl: any) => s + sl.invoice_count, 0);
        const slabTaxableSum = (report.slabs || []).reduce((s: number, sl: any) => s + sl.taxable_value, 0);
        const exemptInvoices = report.summary.total_invoices - slabInvoiceSum;
        const exemptValue = report.summary.total_taxable - slabTaxableSum;

        if (!report?.summary || !Array.isArray(report.invoices)) {
            return (
                <div className="text-center py-20 text-gray-400 text-sm">{t("gstReport.noDataForMonth")}</div>
            );
        }

        return (
            <div id="gst-print-area" className="space-y-5">
                <div className="hidden print:block text-center mb-6">
                    <h2 className="text-xl font-bold">{report.shop?.name}</h2>
                    {report.shop?.gstin && <p className="text-sm">{t("gstReport.gstinLabel")}: {report.shop.gstin}</p>}
                    <h3 className="text-lg font-bold mt-3">{t("gstReport.printTitle")} — {displayLabel}</h3>
                </div>

                {/* Stats Card + Donut + Calendar Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Stats Card - Apple inspired */}
                    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.06)]">
                        {/* Header: Total GST */}
                        <div className="px-5 pt-5 pb-4">
                            <div className="text-left">
                                <h2 className="text-base font-semibold text-gray-900">{t("gstReport.totalGst")}</h2>
                                <p className="text-2xl font-bold text-amber-600 mt-1.5">₹{fmt(report.summary.total_tax)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">GST Collected</p>
                            </div>
                        </div>

                        {/* Stats Grid: Taxable Value | Total Invoices */}
                        <div className="grid grid-cols-2 gap-2.5 px-5 pb-4">
                            <div className="bg-gray-50 rounded-xl px-4 py-3.5">
                                <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-gray-400 mb-1">{t("gstReport.taxableValue")}</div>
                                <div className="text-xl font-bold text-gray-900 tracking-tight">₹{fmt(report.summary.total_taxable)}</div>
                            </div>
                            <div className="bg-gray-50 rounded-xl px-4 py-3.5">
                                <div className="text-[10px] font-semibold tracking-[0.8px] uppercase text-gray-400 mb-1">{t("gstReport.totalInvoices")}</div>
                                <div className="text-xl font-bold text-gray-900 tracking-tight">{report.summary.total_invoices}</div>
                            </div>
                        </div>

                        <div className="h-px bg-gray-100 mx-5" />

                        {/* Chart Section: Grand Total */}
                        {(() => {
                            const dailyTotals: { date: string; total: number }[] = [];
                            const dateMap: Record<string, number> = {};
                            (report.invoices || []).forEach((inv: any) => {
                                const d = new Date(inv.created_at).toLocaleDateString("en-IN");
                                dateMap[d] = (dateMap[d] || 0) + inv.grand_total;
                            });
                            Object.entries(dateMap).forEach(([date, total]) => dailyTotals.push({ date, total }));
                            dailyTotals.sort((a, b) => new Date(a.date.split("/").reverse().join("-")).getTime() - new Date(b.date.split("/").reverse().join("-")).getTime());
                            return (
                        <div className="px-5 pt-4 pb-3">
                            <div className="flex items-baseline gap-2.5 mb-1">
                                <span className="text-2xl font-bold text-gray-900 tracking-tight">₹{fmt(report.summary.grand_total - (report.summary.total_refunds || 0))}</span>
                                <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Total Revenue</span>
                            </div>
                            {(report.summary.total_refunds || 0) > 0 && (
                              <p className="text-xs text-red-500 mt-0.5">Refunds: -₹{fmt(report.summary.total_refunds)}</p>
                            )}
                            <div className="text-xs text-gray-400 mb-3">{displayLabel}</div>
                            <div className="h-[72px] relative">
                                {(() => {
                                    const w = 340, h = 72;
                                    const padding = 16;
                                    const plotW = w - padding * 2;
                                    const plotH = h - padding * 2;
                                    const vals = dailyTotals.map(d => d.total);
                                    const max = Math.max(...vals, 1);
                                    const min = Math.min(...vals, 0);
                                    const range = max - min || 1;
                                    const numPts = dailyTotals.length;
                                    const points = dailyTotals.map((d, i) => ({
                                        x: padding + (i / Math.max(numPts - 1, 1)) * plotW,
                                        y: padding + plotH - ((d.total - min) / range) * plotH,
                                        total: d.total,
                                        date: d.date,
                                    }));
                                    const linePts = points.map(p => `${p.x},${p.y}`).join(" ");
                                    const areaPts = numPts > 0
                                        ? `M${points[0].x},${h} L${points.map(p => `${p.x},${p.y}`).join(" L")} L${points[points.length - 1].x},${h} Z`
                                        : `M0,${h} L${w},${h} Z`;
                                    const isUp = vals.length >= 2 ? vals[vals.length - 1] >= vals[0] : true;
                                    const strokeColor = isUp ? "#7C3AED" : "#EF4444";
                                    const gradId = `grandTotalGrad_${isUp ? "up" : "down"}`;

                                    const handleContainerMove = (e: React.MouseEvent<HTMLDivElement>) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const mx = ((e.clientX - rect.left) / rect.width) * w;
                                        let nearest = 0;
                                        let minDist = Infinity;
                                        points.forEach((p, i) => {
                                            const dist = Math.abs(p.x - mx);
                                            if (dist < minDist) { minDist = dist; nearest = i; }
                                        });
                                        setChartHoverIdx(nearest);
                                    };

                                    return (
                                        <div className="w-full h-full cursor-pointer" onMouseMove={handleContainerMove} onMouseLeave={() => setChartHoverIdx(null)}>
                                            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full pointer-events-none" preserveAspectRatio="xMidYMid meet">
                                                <defs>
                                                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                                                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
                                                    </linearGradient>
                                                </defs>
                                                <path d={areaPts} fill={`url(#${gradId})`} />
                                                {points.length > 0 && (
                                                    <polyline fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={linePts} />
                                                )}
                                                {points.length === 1 && (
                                                    <line x1={points[0].x - 12} y1={points[0].y} x2={points[0].x + 12} y2={points[0].y} stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
                                                )}
                                                {chartHoverIdx !== null && points[chartHoverIdx] && (
                                                    <>
                                                        <line x1={points[chartHoverIdx].x} y1="0" x2={points[chartHoverIdx].x} y2={h} stroke={strokeColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                                                        <circle cx={points[chartHoverIdx].x} cy={points[chartHoverIdx].y} r="4" fill={strokeColor} stroke="#fff" strokeWidth="2" />
                                                    </>
                                                )}
                                            </svg>
                                            {chartHoverIdx !== null && points[chartHoverIdx] && (
                                                <div className="absolute pointer-events-none" style={{ left: `calc(${(points[chartHoverIdx].x / w) * 100}% - 48px)`, top: `${Math.max(0, points[chartHoverIdx].y - 30)}px` }}>
                                                    <div className="bg-[#1c1c1e] text-white text-[10px] font-semibold px-3 py-1.5 rounded whitespace-nowrap text-center shadow-lg">
                                                        ₹{fmt(points[chartHoverIdx].total)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    );
                })()}
                    </div>

                    {/* Donut Chart */}
                    <GstSlabDonut slabs={report.slabs || []} totalTaxable={report.summary.total_taxable} />

                    {/* Calendar */}
                    <div className="w-full [&_.cal-card]:!w-full [&_.cal-card]:max-w-full [&_.cal-card]:h-full [&_.cal-card]:flex [&_.cal-card]:flex-col [&_.days-grid]:flex-1">
                        <DateRangePicker
                            startDate={rangeStart}
                            endDate={rangeEnd}
                            onChange={(start, end) => {
                                handleRangeChange(start, end);
                            }}
                            onMonthSelect={handleMonthSelect}
                            onYearSelect={handleYearSelect}
                        />
                    </div>
                </div>

                {/* GST Slab-wise Summary - Dashboard style */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
                        <div className="text-left">
                            <h3 className="text-sm font-semibold text-gray-800">{t("gstReport.slabSummaryTitle")}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">{t("gstReport.slabSummaryDesc")}</p>
                        </div>
                        <div className="flex items-center gap-2 print:hidden shrink-0">
                            <Button onClick={handleExcelDownload} disabled={!report} className="text-white gap-2 px-4 py-2 text-sm" style={{ background: "linear-gradient(145deg, #22c55e 0%, #16a34a 40%, #15803d 100%)" }}>
                                <HugeiconsIcon icon={CloudDownloadIcon} className="text-lg"  />
                                {t("gstReport.downloadExcel")}
                            </Button>
                            <Button onClick={() => window.print()} disabled={!report} className="text-white gap-2 px-4 py-2 text-sm" style={{ background: "linear-gradient(145deg, #6b68e0 0%, #5b5bc8 40%, #4a4ab0 100%)" }}>
                                <HugeiconsIcon icon={PrinterIcon} className="text-lg"  />
                                {t("gstReport.printButton")}
                            </Button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.taxRateHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.invoicesHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.taxableValueHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.cgstHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.sgstHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.totalTaxHeader")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.summary.total_invoices === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-gray-400 text-sm">{t("gstReport.noGstTransactions")}</td>
                                    </tr>
                                ) : (
                                    <>
                                        {(() => {
                                            const allSlabRows: any[] = [
                                                ...(report.slabs || []).map((s: any) => ({
                                                    key: `${s.tax_percent}%`,
                                                    cells: (
                                                        <>
                                                            <td className="px-5 py-3.5 font-semibold text-gray-800 text-center">{s.tax_percent}%</td>
                                                            <td className="px-5 py-3.5 text-gray-600 text-center">{s.invoice_count}</td>
                                                            <td className="px-5 py-3.5 text-gray-700 text-center">₹{fmt(s.taxable_value)}</td>
                                                            <td className="px-5 py-3.5 text-blue-600 text-center">₹{fmt(s.total_tax / 2)}</td>
                                                            <td className="px-5 py-3.5 text-blue-600 text-center">₹{fmt(s.total_tax / 2)}</td>
                                                            <td className="px-5 py-3.5 font-semibold text-gray-800 text-center">₹{fmt(s.total_tax)}</td>
                                                        </>
                                                    ),
                                                })),
                                            ];
                                            if (!report.slabs || report.slabs.length === 0 || exemptValue > 0 || exemptInvoices > 0) {
                                                allSlabRows.push({
                                                    key: "0%",
                                                    cells: (
                                                        <>
                                                            <td className="px-5 py-3.5 font-semibold text-gray-800 text-center">0% ({t("gstReport.exemptLabel")})</td>
                                                            <td className="px-5 py-3.5 text-gray-600 text-center">{exemptInvoices}</td>
                                                            <td className="px-5 py-3.5 text-gray-700 text-center">₹{fmt(exemptValue)}</td>
                                                            <td className="px-5 py-3.5 text-gray-400 text-center">₹0.00</td>
                                                            <td className="px-5 py-3.5 text-gray-400 text-center">₹0.00</td>
                                                            <td className="px-5 py-3.5 font-semibold text-gray-800 text-center">₹0.00</td>
                                                        </>
                                                    ),
                                                });
                                            }
                                            const totalSlabRows = allSlabRows.length;
                                            const slabPerPage = 5;
                                            const totalSlabPages = Math.max(1, Math.ceil(totalSlabRows / slabPerPage));
                                            const safeSlabPage = Math.min(slabPage, totalSlabPages);
                                            const slabStart = (safeSlabPage - 1) * slabPerPage;
                                            const pageSlabRows = allSlabRows.slice(slabStart, slabStart + slabPerPage);
                                            return (
                                                <>
                                                    {pageSlabRows.map((r: any) => (
                                                        <tr key={r.key} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">{r.cells}</tr>
                                                    ))}
                                                    {totalSlabPages > 1 && (
                                                        <tr>
                                                            <td colSpan={6} className="px-5 py-2">
                                                                <div className="flex items-center justify-center gap-1">
                                                                    <button
                                                                        onClick={() => setSlabPage(safeSlabPage - 1)}
                                                                        disabled={safeSlabPage <= 1}
                                                                        className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    >‹</button>
                                                                    {(() => {
                                                                        const pages: (number | string)[] = [];
                                                                        for (let i = 1; i <= totalSlabPages; i++) {
                                                                            if (i === 1 || i === totalSlabPages || Math.abs(i - safeSlabPage) <= 1) {
                                                                                pages.push(i);
                                                                            } else if (Math.abs(i - safeSlabPage) === 2) {
                                                                                if (pages[pages.length - 1] !== '…') pages.push('…');
                                                                            }
                                                                        }
                                                                        return pages.map((p, i) =>
                                                                            typeof p === 'number' ? (
                                                                                <button key={i} onClick={() => setSlabPage(p)} className={`px-2 py-1 text-xs rounded transition-colors ${p === safeSlabPage ? 'border border-gray-300 bg-white font-medium text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}>{String(p).padStart(2, '0')}</button>
                                                                            ) : (
                                                                                <span key={i} className="text-gray-400 text-xs px-1">…</span>
                                                                            )
                                                                        );
                                                                    })()}
                                                                    <button
                                                                        onClick={() => setSlabPage(safeSlabPage + 1)}
                                                                        disabled={safeSlabPage >= totalSlabPages}
                                                                        className="px-2 py-1 text-xs border border-gray-200 rounded text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                                    >›</button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors font-semibold">
                                                        <td className="px-5 py-3.5 font-bold text-center">{t("gstReport.totalLabel")}</td>
                                                        <td className="px-5 py-3.5 font-bold text-center">{report.summary.total_invoices} {t("gstReport.billsUnit")}</td>
                                                        <td className="px-5 py-3.5 font-bold text-center">₹{fmt(report.summary.total_taxable)}</td>
                                                        <td className="px-5 py-3.5 font-bold text-center">₹{fmt(report.summary.total_tax / 2)}</td>
                                                        <td className="px-5 py-3.5 font-bold text-center">₹{fmt(report.summary.total_tax / 2)}</td>
                                                        <td className="px-5 py-3.5 font-bold text-center">₹{fmt(report.summary.total_tax)}</td>
                                                    </tr>
                                                </>
                                            );
                                        })()}
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Invoice List - Dashboard style */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-800">GST Report Invoice Details</h3>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{displayLabel}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                                <tr>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.invoiceNoHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.dateHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.customerHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.taxableHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">GST Rate</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.taxHeader")}</th>
                                    <th className="text-center px-5 py-3 text-xs font-medium text-gray-500">{t("gstReport.grandTotalHeader")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {totalInvoices === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">{t("gstReport.noInvoices")}</td>
                                    </tr>
                                ) : (
                                    pageInvoices.map((inv: any, i: number) => (
                                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3.5 font-mono text-blue-600 text-center">#{inv.invoice_number}</td>
                                            <td className="px-5 py-3.5 text-gray-500 text-center">
                                                {new Date(inv.created_at).toLocaleDateString("en-IN")}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-800 text-center">
                                                {inv.customer_name || t("gstReport.walkInCustomer")}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-700 text-center">₹{fmt(inv.total)}</td>
                                            <td className="px-5 py-3.5 text-center"><span className="inline-block px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded">{inv.gst_rates || "0%"}</span></td>
                                            <td className="px-5 py-3.5 text-amber-600 text-center">₹{fmt(inv.tax)}</td>
                                            <td className="px-5 py-3.5 font-semibold text-gray-800 text-center">₹{fmt(inv.grand_total)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalInvoicePages > 1 && (
                        <div className="flex items-center justify-center gap-1 px-5 py-4 border-t border-gray-100">
                            <button
                                onClick={() => setInvoicePage(safeInvoicePage - 1)}
                                disabled={safeInvoicePage <= 1}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >‹</button>
                            {(() => {
                                const pages: (number | string)[] = [];
                                for (let i = 1; i <= totalInvoicePages; i++) {
                                    if (i === 1 || i === totalInvoicePages || Math.abs(i - safeInvoicePage) <= 1) {
                                        pages.push(i);
                                    } else if (Math.abs(i - safeInvoicePage) === 2) {
                                        if (pages[pages.length - 1] !== '…') pages.push('…');
                                    }
                                }
                                return pages.map((p, i) =>
                                    typeof p === 'number' ? (
                                        <button
                                            key={i}
                                            onClick={() => setInvoicePage(p)}
                                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                                                p === safeInvoicePage
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
                                onClick={() => setInvoicePage(safeInvoicePage + 1)}
                                disabled={safeInvoicePage >= totalInvoicePages}
                                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >›</button>
                        </div>
                    )}
                </div>
            </div>
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


            {viewMode === "daily" ? renderDailyView() : renderMonthlyView()}

            {/* Print styles */}
            <style>{`
        @media print {
          @page { size: A4; margin: 15mm; }
          body * { visibility: hidden; }
          [data-print-area], [data-print-area] * { visibility: visible; }
          [data-print-area] { position: absolute; left: 0; top: 0; width: 100%; }
          [ref="printRef"], [ref="printRef"] * { visibility: visible; }
          [ref="printRef"] { position: absolute; left: 0; top: 0; width: 100%; }
          #gst-print-area, #gst-print-area * { visibility: visible; }
          #gst-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
        </div>
    );
}
