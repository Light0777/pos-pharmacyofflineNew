import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert01Icon,
  Search01Icon,
  Cancel01Icon,
  PackageIcon,
} from "@hugeicons/core-free-icons";
import { apiGet } from "../../renderer/services/api";
import { Input } from "@/components/ui/input";
import * as XLSX from "xlsx";

interface ExpiredBatch {
  batch_uuid: string;
  product_uuid: string;
  product_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  mrp: number;
}

function formatCurrency(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

export default function ExpiredMedicines() {
  const { t } = useTranslation();
  const [batches, setBatches] = useState<ExpiredBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadExpired = async () => {
    setLoading(true);
    try {
      const json = await apiGet("/product-batches/expired");
      setBatches(json.data || []);
    } catch (err) {
      console.error("Failed to load expired batches:", err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpired();
  }, []);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return batches;
    const q = searchTerm.toLowerCase();
    return batches.filter((b) =>
      [b.product_name, b.batch_number].some((f) => f?.toLowerCase().includes(q))
    );
  }, [batches, searchTerm]);

  const totalQty = filtered.reduce((sum, b) => sum + b.quantity, 0);
  const totalLoss = filtered.reduce((sum, b) => sum + b.quantity * b.mrp, 0);
  const uniqueProducts = new Set(filtered.map((b) => b.product_uuid)).size;

  const exportToXLS = () => {
    const rows = filtered.map((b) => [
      b.product_name,
      b.batch_number,
      b.expiry_date,
      b.quantity,
      b.mrp,
      b.quantity * b.mrp,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      ["Product", "Batch No", "Expiry Date", "Qty", "MRP", "Loss"],
      ...rows,
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expired Medicines");
    XLSX.writeFile(wb, `Expired_Medicines_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {t("adminLayout.nav.expiredMedicines")}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Track and review expired medicine batches
          </p>
        </div>
        <div className="flex items-center gap-3">
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-start">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Expired</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">Total Batches</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">
              {batches.length}
            </p>
            <p className="text-xs text-gray-500 mt-1">across all products</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Affected</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">Products</p>
            <p className="text-5xl font-bold text-gray-900 leading-none">
              {uniqueProducts}
            </p>
            <p className="text-xs text-gray-500 mt-1">with expired stock</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Units</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">Total Quantity</p>
            <p className="text-5xl font-bold text-orange-600 leading-none">
              {totalQty}
            </p>
            <p className="text-xs text-gray-500 mt-1">items expiring</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
          <div className="flex-shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Loss</p>
            <p className="text-sm font-semibold text-gray-700 mb-3">Total Value</p>
            <p className="text-5xl font-bold text-red-600 leading-none">
              {formatCurrency(totalLoss)}
            </p>
            <p className="text-xs text-gray-500 mt-1">at MRP</p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-4">
          <div className="relative flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            />
            <Input
              placeholder="Search by product name or batch number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-11 pr-10 py-2.5 bg-slate-50 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <HugeiconsIcon icon={Cancel01Icon} className="text-lg" />
              </button>
            )}
          </div>
          <div className="text-xs text-slate-400 font-medium whitespace-nowrap">
            {filtered.length} of {batches.length} batches
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className=" px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                <th className=" px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Batch No</th>
                <th className=" px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Expiry Date</th>
                <th className=" px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
                <th className=" px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">MRP</th>
                <th className=" px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Loss</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <HugeiconsIcon icon={PackageIcon} className="text-slate-300 text-4xl" />
                      <p className="text-slate-400 text-sm font-medium">
                        {searchTerm
                          ? "No expired batches match your search"
                          : "No expired products found"}
                      </p>
                      {!searchTerm && (
                        <p className="text-slate-400 text-xs">All medicines are within expiry</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const loss = b.quantity * b.mrp;
                  const daysExpired = Math.floor(
                    (Date.now() - new Date(b.expiry_date).getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={b.batch_uuid} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-800 ">
                        {b.product_name}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 font-mono ">
                        {b.batch_number}
                      </td>
                      <td className="px-5 py-3.5 ">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                          <HugeiconsIcon icon={Alert01Icon} className="text-xs" />
                          {b.expiry_date}
                        </span>
                        {daysExpired > 0 && (
                          <span className="ml-1.5 text-xs text-red-400 font-medium">
                            ({daysExpired}d ago)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                        {b.quantity}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {formatCurrency(b.mrp)}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-red-600">
                        {formatCurrency(loss)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
