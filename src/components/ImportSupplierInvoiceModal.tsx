import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudUploadIcon,
  Cancel01Icon,
  CheckmarkCircle01Icon,
  Alert01Icon,
  File01Icon,
} from "@hugeicons/core-free-icons";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import SimpleDatePicker from "./SimpleDatePicker";
import { getSuppliers, createSupplier } from "../renderer/services/supplierApi";
import type { Supplier } from "../renderer/services/supplierApi";
import { uploadImportFile, confirmAutoUpdate } from "../renderer/services/importApi";
import type { SupplierInvoiceItem } from "../renderer/services/importApi";

type Step = "upload" | "preview" | "done";

export default function ImportSupplierInvoiceModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewItems, setPreviewItems] = useState<SupplierInvoiceItem[]>([]);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    errors: Array<{ item: string; error: string }>;
    purchase_uuid?: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Supplier combobox state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierUuid, setSupplierUuid] = useState("");
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false);
  const [recentSuppliers, setRecentSuppliers] = useState<Supplier[]>([]);

  // Invoice fields
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Supplier dropdown position
  const supplierBtnRef = useRef<HTMLInputElement>(null);
  const [supplierPickPos, setSupplierPickPos] = useState({ top: 0, left: 0, width: 0 });

  // Date picker state
  const invoiceBtnRef = useRef<HTMLButtonElement>(null);
  const [invoiceShowPicker, setInvoiceShowPicker] = useState(false);
  const [invoicePickPos, setInvoicePickPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    getSuppliers().then((list) => {
      setSuppliers(list);
      try {
        const stored = localStorage.getItem("recent_suppliers");
        if (stored) {
          const uuids: string[] = JSON.parse(stored);
          const recents = uuids.map((id) => list.find((s) => s.supplier_uuid === id)).filter(Boolean) as Supplier[];
          setRecentSuppliers(recents);
        }
      } catch (e) {}
    });
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      setError("Unsupported file type. Please upload .xlsx, .xls or .csv");
      return;
    }
    setError(null);
    setFile(selectedFile);
  };

  const enrichItems = (items: SupplierInvoiceItem[]) =>
    items.map((item) => ({
      ...item,
      unitsPerPack: item.pack ? 10 : 1,
      disc: 0,
      cgst: ((item.gst ?? 0) / 2),
      sgst: ((item.gst ?? 0) / 2),
    }));

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await uploadImportFile(file);
      if (!res.success) {
        setError(res.message || "Failed to parse file");
        setLoading(false);
        return;
      }
      const validItems = res.data.items.filter((i: any) => i.product_name && i.product_name.trim() !== '—' && i.product_name.trim() !== '');
      setPreviewItems(enrichItems(validItems));
      setStep("preview");
    } catch (e: any) {
      setError(e.message || "Upload failed");
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await confirmAutoUpdate({
        supplier_uuid: supplierUuid || undefined,
        invoice_number: invoiceNumber || undefined,
        invoice_date: invoiceDate || undefined,
        items: previewItems,
      });
      if (!res.success) {
        setError((res as any).error || "Import failed");
        setLoading(false);
        return;
      }
      setResult(res);
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Import failed");
    }
    setLoading(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  }, []);

  const renderUpload = () => (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
          <HugeiconsIcon icon={Alert01Icon} className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* File drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          file ? "border-emerald-400 bg-emerald-50/50" : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <HugeiconsIcon icon={File01Icon} className="w-8 h-8 text-emerald-600" />
            <div className="text-left">
              <p className="text-sm font-medium text-slate-800">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-red-500"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <HugeiconsIcon icon={CloudUploadIcon} className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm text-slate-600 font-medium">Drop your file here or click to browse</p>
            <p className="text-xs text-slate-400">Supports .xlsx, .xls, .csv files</p>
          </div>
        )}
      </div>

      {/* Supplier + Invoice fields */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="relative">
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Supplier</label>
          <input
            ref={supplierBtnRef}
            type="text"
            value={supplierSearch}
            onChange={(e) => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setSupplierUuid(""); }}
            onFocus={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
              setSupplierPickPos({
                top: fitsBelow ? rect.bottom + 4 : rect.top - 300,
                left: rect.left,
                width: rect.width,
              });
              setSupplierDropdownOpen(true);
            }}
            placeholder="Search or type supplier"
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
          />
          {supplierDropdownOpen && (
            <>
              <div className="fixed inset-0 z-[71]" onClick={() => setSupplierDropdownOpen(false)} />
              <div
                className="fixed z-[72] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden"
                style={{ top: supplierPickPos.top, left: supplierPickPos.left, width: supplierPickPos.width }}
              >
                <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                  {suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && !supplierSearch.trim() ? (
                    <div className="px-4 py-6 text-center text-sm text-slate-400">Type to search suppliers</div>
                  ) : (
                    <>
                      {!supplierSearch.trim() && recentSuppliers.length > 0 && (
                        <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide bg-slate-50/50">
                          Recent Suppliers
                        </div>
                      )}
                      {!supplierSearch.trim() && recentSuppliers.map((s) => (
                        <button
                          key={s.supplier_uuid}
                          type="button"
                          onClick={() => {
                            setSupplierUuid(s.supplier_uuid);
                            setSupplierSearch(s.name);
                            setSupplierDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                            supplierUuid === s.supplier_uuid ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700"
                          }`}
                        >
                          <span>{s.name}</span>
                          {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                        </button>
                      ))}
                      {supplierSearch.trim() && suppliers.filter((s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map((s) => (
                        <button
                          key={s.supplier_uuid}
                          type="button"
                          onClick={() => {
                            setSupplierUuid(s.supplier_uuid);
                            setSupplierSearch(s.name);
                            setSupplierDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                            supplierUuid === s.supplier_uuid ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700"
                          }`}
                        >
                          <span>{s.name}</span>
                          {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                        </button>
                      ))}
                      {supplierSearch.trim() && !suppliers.some((s) => s.name.toLowerCase() === supplierSearch.trim().toLowerCase()) && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const created = await createSupplier({ name: supplierSearch.trim() });
                              setSupplierUuid(created.supplier_uuid || created.uuid);
                              setSupplierSearch(supplierSearch.trim());
                              setSupplierDropdownOpen(false);
                              setSuppliers((prev) => [...prev, created]);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 font-medium border-t border-slate-100 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                          </svg>
                          + Add as new supplier
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Invoice Number</label>
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="e.g. INV-001"
            className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Invoice Date</label>
          <div className="relative">
            <button
              ref={invoiceBtnRef}
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                setInvoicePickPos({
                  top: fitsBelow ? rect.bottom + 4 : rect.top - 300,
                  right: document.documentElement.clientWidth - rect.right,
                });
                setInvoiceShowPicker(!invoiceShowPicker);
              }}
              className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            >
              <CalendarIcon className="w-4 h-4 text-slate-400" />
              <span>{invoiceDate ? format(new Date(invoiceDate + "T00:00:00"), "dd MMM yyyy") : "Pick a date"}</span>
            </button>
            {invoiceShowPicker && (
              <div className="fixed z-[70]" style={{ top: invoicePickPos.top, right: invoicePickPos.right }}>
                <SimpleDatePicker
                  date={invoiceDate ? new Date(invoiceDate + "T00:00:00") : undefined}
                  onSelect={(d) => { setInvoiceDate(format(d, "yyyy-MM-dd")); setInvoiceShowPicker(false); }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const addRow = () => {
    setPreviewItems((prev) =>
      enrichItems([...prev, { product_name: "", batch: "", expiry: "", qty: 1, mrp: 0, rate: 0, gst: 0 }])
    );
  };

  const removeRow = (idx: number) => {
    setPreviewItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<any>) => {
    setPreviewItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const nv = (v: any) => (v === 0 || v === '0' ? '0' : String(v ?? 0));
  const handleNum = (idx: number, field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { updateItem(idx, { [field]: 0 }); return; }
    updateItem(idx, { [field]: Number(raw) });
  };

  const calcRow = (item: any) => {
    const packs = Number(item.qty) || 0;
    const upp = Number(item.unitsPerPack) || 1;
    const rate = Number(item.rate) || 0;
    const disc = Number(item.disc) || 0;
    const cgst = Number(item.cgst) || 0;
    const sgst = Number(item.sgst) || 0;
    const units = packs * upp;
    const unitPrice = upp > 0 ? rate / upp : 0;
    let amount = packs * rate;
    amount -= amount * (disc / 100);
    amount += amount * ((cgst + sgst) / 100);
    return { units, unitPrice, amount };
  };

  const renderPreview = () => {
    const filtered = searchQuery
      ? previewItems.filter((item) =>
          item.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : previewItems;

    return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
          <HugeiconsIcon icon={Alert01Icon} className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Supplier + Invoice info */}
      <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">
        {supplierSearch && <span><strong>Supplier:</strong> {supplierSearch}</span>}
        {invoiceNumber && <span><strong>Invoice:</strong> {invoiceNumber}</span>}
        {invoiceDate && <span><strong>Date:</strong> {format(new Date(invoiceDate + "T00:00:00"), "dd MMM yyyy")}</span>}
        <span className="ml-auto font-semibold text-emerald-700">{previewItems.length} items</span>
      </div>

      {/* Search + add */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
          <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product..."
            className="flex-1 outline-none text-sm text-slate-600 placeholder-slate-400 bg-transparent"
          />
        </div>
        <button
          onClick={addRow}
          className="p-2 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200"
          title="Add row"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Preview table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 330px)" }}>
          <table className="w-full text-xs border-collapse min-w-[1400px]">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                <th className="text-left px-2 py-2 min-w-[140px]">Product</th>
                <th className="text-left px-2 py-2 min-w-[50px]">HSN</th>
                <th className="text-left px-2 py-2 min-w-[80px]">Mfr.</th>
                <th className="text-left px-2 py-2 min-w-[70px]">Batch</th>
                <th className="text-left px-2 py-2 min-w-[90px]">Pack</th>
                <th className="text-center px-2 py-2 min-w-[50px]">Packs</th>
                <th className="text-center px-2 py-2 min-w-[60px]">Units/Pack</th>
                <th className="text-center px-2 py-2 min-w-[50px]">Units</th>
                <th className="text-right px-2 py-2 min-w-[65px]">Rate/Pack</th>
                <th className="text-right px-2 py-2 min-w-[60px]">MRP</th>
                <th className="text-right px-2 py-2 min-w-[60px]">Unit ₹</th>
                <th className="text-center px-2 py-2 min-w-[50px]">Disc%</th>
                <th className="text-center px-2 py-2 min-w-[55px]">CGST%</th>
                <th className="text-center px-2 py-2 min-w-[55px]">SGST%</th>
                <th className="text-left px-2 py-2 min-w-[80px]">Expiry</th>
                <th className="text-right px-2 py-2 min-w-[70px]">Amount</th>
                <th className="text-center px-2 py-2 min-w-[40px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item, i) => {
                const { units, unitPrice, amount } = calcRow(item);
                return (
                <tr key={i} className="hover:bg-slate-50/50">
                  <td className="px-1.5 py-1">
                    <input
                      value={item.product_name}
                      onChange={(e) => updateItem(i, { product_name: e.target.value })}
                      className="w-full text-xs font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1 outline-none transition-colors"
                    />
                    {item.manufacturer ? (
                      <input
                        value={item.manufacturer}
                        onChange={(e) => updateItem(i, { manufacturer: e.target.value })}
                        className="w-full text-[10px] text-slate-400 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-0.5 outline-none transition-colors mt-0.5"
                      />
                    ) : null}
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={item.hsn || ""}
                      onChange={(e) => updateItem(i, { hsn: e.target.value })}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={item.manufacturer || ""}
                      onChange={(e) => updateItem(i, { manufacturer: e.target.value })}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={item.batch || ""}
                      onChange={(e) => updateItem(i, { batch: e.target.value })}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <select
                      value={item.pack || "Strip"}
                      onChange={(e) => updateItem(i, { pack: e.target.value })}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors"
                    >
                      <option>Strip</option>
                      <option>Box</option>
                      <option>Bottle</option>
                      <option>Loose</option>
                    </select>
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      min="0"
                      value={nv(item.qty)}
                      onChange={handleNum(i, 'qty')}
                      className="w-full text-xs font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors text-center"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      min="1"
                      value={nv(item.unitsPerPack)}
                      onChange={handleNum(i, 'unitsPerPack')}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors text-center"
                    />
                  </td>
                  <td className="px-2 py-1 text-center text-xs font-medium text-slate-700">{units}</td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={nv(item.rate)}
                      onChange={handleNum(i, 'rate')}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors text-right"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={nv(item.mrp)}
                      onChange={handleNum(i, 'mrp')}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors text-right"
                    />
                  </td>
                  <td className="px-2 py-1 text-right text-xs font-medium text-slate-500">{unitPrice.toFixed(2)}</td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={nv(item.disc)}
                      onChange={handleNum(i, 'disc')}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors text-center"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={nv(item.cgst)}
                      onChange={handleNum(i, 'cgst')}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors text-center"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={nv(item.sgst)}
                      onChange={handleNum(i, 'sgst')}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors text-center"
                    />
                  </td>
                  <td className="px-1.5 py-1">
                    <input
                      value={item.expiry || ""}
                      onChange={(e) => updateItem(i, { expiry: e.target.value })}
                      className="w-full text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-400 focus:bg-white rounded-lg px-2 py-1.5 outline-none transition-colors"
                    />
                  </td>
                  <td className="px-2 py-1 text-right text-xs font-semibold text-slate-800">₹{amount.toFixed(2)}</td>
                  <td className="px-1.5 py-1 text-center">
                    <button
                      onClick={() => removeRow(i)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-4 py-8 text-center text-xs text-slate-400">
                    {searchQuery ? "No matching items" : "No items to display"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const renderDone = () => (
    <div className="text-center py-8 space-y-4">
      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="w-16 h-16 text-emerald-500 mx-auto" />
      <h3 className="text-xl font-bold text-slate-800">Import Complete</h3>
      <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
        <div className="bg-emerald-50 rounded-xl p-4">
          <p className="text-3xl font-bold text-emerald-600">{result?.created || 0}</p>
          <p className="text-sm text-emerald-700 font-medium">Created</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-3xl font-bold text-blue-600">{result?.updated || 0}</p>
          <p className="text-sm text-blue-700 font-medium">Updated</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <p className="text-3xl font-bold text-amber-600">{result?.errors?.length || 0}</p>
          <p className="text-sm text-amber-700 font-medium">Errors</p>
        </div>
      </div>
      {result?.purchase_uuid && (
        <p className="text-xs text-slate-500">
          Purchase UUID: <span className="font-mono text-slate-700">{result.purchase_uuid}</span>
        </p>
      )}
      {result?.errors && result.errors.length > 0 && (
        <div className="text-left max-h-32 overflow-y-auto border border-red-200 rounded-xl p-3 bg-red-50/50">
          <p className="text-xs font-semibold text-red-600 mb-1">Errors:</p>
          {result.errors.map((e, i) => (
            <p key={i} className="text-xs text-red-500">
              {e.item}: {e.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );

  return <>
      <style>{`input[type="number"]::-webkit-inner-spin-button,input[type="number"]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}input[type="number"]{-moz-appearance:textfield}`}</style>
      {createPortal(
      <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
      <div className="absolute inset-0 overflow-hidden flex flex-col">
        <div
          className="bg-white flex flex-col flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Import from Supplier Invoice</h2>
              <p className="text-xs text-slate-500">
                {step === "upload" && "Upload an Excel or CSV file to preview"}
                {step === "preview" && "Review parsed data before importing"}
                {step === "done" && "Import completed"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {step === "upload" && renderUpload()}
            {step === "preview" && renderPreview()}
            {step === "done" && renderDone()}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
            {step === "upload" && (
              <>
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Parsing...</>
                  ) : (
                    <>Preview & Continue</>
                  )}
                </button>
              </>
            )}
            {step === "preview" && (
              <>
                <button
                  onClick={() => setStep("upload")}
                  className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</>
                  ) : (
                    `Import ${previewItems.length} items`
                  )}
                </button>
              </>
            )}
            {step === "done" && (
              <button
                onClick={() => { onImported(); onClose(); }}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )}
  </>;
}  
