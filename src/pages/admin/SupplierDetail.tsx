import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { getSuppliers, type Supplier } from "../../renderer/services/supplierApi";
import { getSupplierBills, createSupplierBill, deleteSupplierBill, type SupplierBill } from "../../renderer/services/supplierBillApi";
import { getPurchases } from "../../renderer/services/purchaseApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  Cancel01Icon,
  Image01Icon,
  Delete01Icon,
  CallIcon,
  Mail01Icon,
  Location01Icon,
  ReceiptIndianRupeeIcon,
  Calendar01Icon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

function compressImage(file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = h * maxWidth / w; w = maxWidth; }
        if (h > maxHeight) { w = w * maxHeight / h; h = maxHeight; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SupplierDetail() {
  const { t } = useTranslation();
  const { supplier_uuid } = useParams<{ supplier_uuid: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [bills, setBills] = useState<SupplierBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"bills" | "history">("bills");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);

  const loadData = async () => {
    if (!supplier_uuid) return;
    setLoading(true);
    try {
      const all = await getSuppliers();
      const s = all.find((x) => x.supplier_uuid === supplier_uuid);
      setSupplier(s || null);
      const b = await getSupplierBills(supplier_uuid);
      setBills(b);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [supplier_uuid]);

  const loadPurchases = async () => {
    if (!supplier_uuid) return;
    setPurchasesLoading(true);
    try {
      const data = await getPurchases(supplier_uuid);
      setPurchases(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadPurchases();
    }
  }, [activeTab, supplier_uuid]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supplier_uuid) return;
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      await createSupplierBill(supplier_uuid, dataUrl);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (billUuid: string) => {
    try {
      await deleteSupplierBill(billUuid);
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-slate-500">Supplier not found</p>
        <Button variant="outline" onClick={() => navigate("/admin/supplier")}>Back to Suppliers</Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/admin/supplier")} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <HugeiconsIcon icon={ArrowLeft01Icon} className="text-xl text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{supplier.name}</h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-slate-500">
            {supplier.phone && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={CallIcon} className="text-sm text-slate-400" />
                {supplier.phone}
              </span>
            )}
            {supplier.email && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Mail01Icon} className="text-sm text-slate-400" />
                {supplier.email}
              </span>
            )}
            {supplier.address && (
              <span className="flex items-center gap-1">
                <HugeiconsIcon icon={Location01Icon} className="text-sm text-slate-400" />
                {supplier.address}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab("bills")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "bills"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <HugeiconsIcon icon={Image01Icon} className="text-lg" />
          Bill Images
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeTab === "history"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <HugeiconsIcon icon={ReceiptIndianRupeeIcon} className="text-lg" />
          Bill History
        </button>
      </div>

      {/* Bill Images Tab */}
      {activeTab === "bills" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-700">Bill Images</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              className="hidden"
              onChange={handleFilePick}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2"
            >
              <HugeiconsIcon icon={Image01Icon} className="text-lg" />
              {uploading ? "Uploading..." : "Add Bill Photo"}
            </Button>
          </div>

          {bills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <HugeiconsIcon icon={Image01Icon} className="text-3xl text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">No bills yet</p>
              <p className="text-xs text-slate-400 mt-1">Click "Add Bill Photo" to upload a bill image</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {bills.map((bill) => (
                <div key={bill.bill_uuid} className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <button
                    onClick={() => setFullImage(bill.bill_image || null)}
                    className="block w-full aspect-[3/4] bg-slate-100 overflow-hidden"
                  >
                    {bill.bill_image ? (
                      <img src={bill.bill_image} alt="Bill" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-300">
                        <HugeiconsIcon icon={Image01Icon} className="text-4xl" />
                      </div>
                    )}
                  </button>
                  <div className="p-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {new Date(bill.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(bill.bill_uuid); }}
                      className="p-1 rounded-md text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="text-sm" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bill History Tab */}
      {activeTab === "history" && (
        <div>
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Bill History</h2>
          {purchasesLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <HugeiconsIcon icon={ReceiptIndianRupeeIcon} className="text-3xl text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">No purchase records found</p>
              <p className="text-xs text-slate-400 mt-1">Purchases with this supplier will appear here</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">Invoice #</th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-slate-500">Date</th>
                    <th className="px-4 py-3 text-xs font-medium text-slate-500">Items</th>
                    <th className="text-end px-4 py-3 text-xs font-medium text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p: any) => (
                    <tr key={p.purchase_uuid} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {p.invoice_number || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <span className="flex items-center gap-1.5">
                          <HugeiconsIcon icon={Calendar01Icon} className="text-sm text-slate-400" />
                          {p.invoice_date
                            ? new Date(p.invoice_date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                            : new Date(p.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </span>
                      </td>
                      <td className=" text-slate-600">{p.items?.length || 0}</td>
                      <td className="px-4 py-3 text-end font-semibold text-slate-800">₹{Number(p.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Full Image Modal */}
      {fullImage && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4" onClick={() => setFullImage(null)}>
          <div className="relative max-w-3xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setFullImage(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center z-10">
              <HugeiconsIcon icon={Cancel01Icon} className="text-lg text-slate-600" />
            </button>
            <img src={fullImage} alt="Bill" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl" />
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium text-slate-700 mb-4">Delete this bill photo?</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteConfirm)}>Delete</Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
