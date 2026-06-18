import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getStockAdjustments, createStockAdjustment } from "../../renderer/services/stockAdjustmentApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  RefreshIcon,
  Add01Icon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  ChartUpIcon,
  ChartDownIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function StockAdjustments() {
  const { t } = useTranslation();
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    product_uuid: "",
    batch_uuid: "",
    adjustment_type: "increase",
    quantity: 0,
    note: "",
  });

  const loadAdjustments = async () => {
    setLoading(true);
    try {
      const data = await getStockAdjustments();
      setAdjustments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load stock adjustments:", err);
      setAdjustments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdjustments();
  }, []);

  const filtered = adjustments.filter((a) =>
    [a.adjustment_type, a.note, a.product_name]
      .some((f) => f?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async () => {
    if (!form.product_uuid || !form.batch_uuid || !form.quantity) {
      setError("Product, batch, and quantity are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createStockAdjustment(form as any);
      setModalOpen(false);
      setForm({ product_uuid: "", batch_uuid: "", adjustment_type: "increase", quantity: 0, note: "" });
      await loadAdjustments();
    } catch (err: any) {
      setError(err.message || "Failed to create adjustment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FC] p-6 space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Stock Adjustments</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manual stock in/out adjustments</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadAdjustments} className="bg-white border-slate-200">
            <HugeiconsIcon icon={RefreshIcon} className="text-slate-600 text-xl"  />
          </Button>
          <Button onClick={() => setModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <HugeiconsIcon icon={Add01Icon} className="text-lg"  />
            New Adjustment
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative mb-4">
            <HugeiconsIcon icon={Search01Icon} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"  />
            <Input
              placeholder="Search adjustments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-slate-400 py-12">No stock adjustments found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a: any) => (
                    <TableRow key={a.adjustment_uuid || a.id}>
                      <TableCell className="text-xs font-mono text-slate-500 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.adjustment_type === "increase" ? "success" : "danger"} className="gap-1">
                          <HugeiconsIcon icon={a.adjustment_type === "increase" ? ChartUpIcon : ChartDownIcon} className="text-xs"  />
                          {a.adjustment_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">{a.product_name || a.product_uuid}</TableCell>
                      <TableCell className="text-right font-semibold">{a.quantity}</TableCell>
                      <TableCell className="text-sm text-slate-500 max-w-[200px] truncate">{a.note || "-"}</TableCell>
                      <TableCell className="text-slate-600 text-sm">{a.performed_by_name || a.performed_by?.slice(0, 8) || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#171717] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="sticky top-0 bg-[#171717] border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">New Stock Adjustment</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-200 transition-colors">
                <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-900/50 border border-red-700 rounded-xl flex items-center gap-2 text-red-200 text-sm">
                  <HugeiconsIcon icon={Alert01Icon} className="text-lg flex-shrink-0"  />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm text-start font-bold text-gray-300 mb-1.5">Product UUID *</label>
                <Input
                  placeholder="product_uuid"
                  value={form.product_uuid}
                  onChange={(e) => setForm({ ...form, product_uuid: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-base text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-start font-bold text-gray-300 mb-1.5">Batch UUID *</label>
                <Input
                  placeholder="batch_uuid"
                  value={form.batch_uuid}
                  onChange={(e) => setForm({ ...form, batch_uuid: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-base text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-start font-bold text-gray-300 mb-1.5">Type</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setForm({ ...form, adjustment_type: "increase" })}
                    className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.adjustment_type === "increase"
                        ? "border-green-500 bg-green-900/30 text-green-300"
                        : "border-gray-600 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <HugeiconsIcon icon={ChartUpIcon} className="mr-1"  />
                    Increase
                  </button>
                  <button
                    onClick={() => setForm({ ...form, adjustment_type: "decrease" })}
                    className={`flex-1 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.adjustment_type === "decrease"
                        ? "border-red-500 bg-red-900/30 text-red-300"
                        : "border-gray-600 text-gray-400 hover:border-gray-500"
                    }`}
                  >
                    <HugeiconsIcon icon={ChartDownIcon} className="mr-1"  />
                    Decrease
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-start font-bold text-gray-300 mb-1.5">Quantity *</label>
                <Input
                  type="number"
                  min={1}
                  placeholder="0"
                  value={form.quantity || ""}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  className="h-10 w-full rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-base text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-start font-bold text-gray-300 mb-1.5">Note</label>
                <Input
                  placeholder="Reason for adjustment"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  className="h-10 w-full rounded-lg border border-gray-600 bg-gray-800 px-2.5 py-1 text-base text-white"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#171717] border-t border-gray-700 px-6 py-4 rounded-b-2xl flex justify-end gap-3">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="border-gray-600 text-gray-300 hover:bg-gray-800">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="text-lg"  />
                    Save Adjustment
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
