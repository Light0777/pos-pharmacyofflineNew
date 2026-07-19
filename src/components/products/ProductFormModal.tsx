import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import SimpleDatePicker from "../SimpleDatePicker";
import { createSupplier } from "../../renderer/services/supplierApi";
import type { Supplier } from "../../renderer/services/supplierApi";
import type { BatchRow } from "./constants";
import {
  GST_OPTIONS, SCHEDULE_TYPES, CATEGORY_OPTIONS, CATEGORY_DEFAULTS,
  UNIT_OPTIONS,
} from "./constants";
import { Badge, Spinner, Input, Select, Toggle, Dropdown, compressImage } from "./ui";

interface ProductFormModalProps {
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  editing: any;
  formKey: number;
  error: string | null;
  batchRows: BatchRow[];
  addBatchRow: () => void;
  removeBatchRow: (id: string) => void;
  updateBatchRow: (id: string, field: string, value: string) => void;
  confirmDeleteBatch: (e: React.MouseEvent, id: string) => void;
  deleteBatchConfirm: string | null;
  setDeleteBatchConfirm: React.Dispatch<React.SetStateAction<string | null>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  supplierSearch: string;
  setSupplierSearch: React.Dispatch<React.SetStateAction<string>>;
  supplierDropdownOpen: boolean;
  setSupplierDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recentSuppliers: Supplier[];
  setRecentSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  units: any[];
  handleAddUnit: () => Promise<void>;
  handleDeleteUnit: (unit_uuid: string) => Promise<void>;
  showUnitForm: boolean;
  setShowUnitForm: React.Dispatch<React.SetStateAction<boolean>>;
  unitForm: any;
  setUnitForm: React.Dispatch<React.SetStateAction<any>>;
  handleSubmit: () => Promise<void>;
  resetForm: () => void;
  loading: boolean;
  isSimpleType: boolean;
  isBottleMedicine: boolean;
  isBandageType: boolean;
  isGeneralType: boolean;
  user: any;
  deleting: string | null;
  editingPurchaseUuid: string | null;
  editingBatchUuid: string | null;
  products: any[];
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
  showNewPurchase: boolean;
  setShowNewPurchase: React.Dispatch<React.SetStateAction<boolean>>;
  newSupplierSearch: string;
  setNewSupplierSearch: React.Dispatch<React.SetStateAction<string>>;
  newSupplierDropdownOpen: boolean;
  setNewSupplierDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newInvoiceNumber: string;
  setNewInvoiceNumber: React.Dispatch<React.SetStateAction<string>>;
  newInvoiceDate: string;
  setNewInvoiceDate: React.Dispatch<React.SetStateAction<string>>;
  newInvoiceShowPicker: boolean;
  setNewInvoiceShowPicker: React.Dispatch<React.SetStateAction<boolean>>;
  newInvoiceBtnRef: React.RefObject<HTMLButtonElement | null>;
  newInvoicePickPos: { top: number; right: number };
  setNewInvoicePickPos: React.Dispatch<React.SetStateAction<{ top: number; right: number }>>;
  newPurchaseDiscount: string;
  setNewPurchaseDiscount: React.Dispatch<React.SetStateAction<string>>;
  manualSubtotal: string | null;
  setManualSubtotal: React.Dispatch<React.SetStateAction<string | null>>;
  newManualSubtotal: string | null;
  setNewManualSubtotal: React.Dispatch<React.SetStateAction<string | null>>;
  newPurchaseBatchIds: string[];
  setNewPurchaseBatchIds: React.Dispatch<React.SetStateAction<string[]>>;
  newPurchaseBatchOpen: boolean;
  setNewPurchaseBatchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mfgShowPicker: boolean;
  setMfgShowPicker: React.Dispatch<React.SetStateAction<boolean>>;
  mfgPickPos: { top: number; right: number };
  setMfgPickPos: React.Dispatch<React.SetStateAction<{ top: number; right: number }>>;
  mfgBtnRef: React.RefObject<HTMLButtonElement | null>;
  expiryShowPicker: boolean;
  setExpiryShowPicker: React.Dispatch<React.SetStateAction<boolean>>;
  expiryPickPos: { top: number; right: number };
  setExpiryPickPos: React.Dispatch<React.SetStateAction<{ top: number; right: number }>>;
  expiryBtnRef: React.RefObject<HTMLButtonElement | null>;
  batchDatePicker: { id: string; field: 'mfg' | 'exp'; top: number; right: number } | null;
  setBatchDatePicker: React.Dispatch<React.SetStateAction<{ id: string; field: 'mfg' | 'exp'; top: number; right: number } | null>>;
  invoiceShowPicker: boolean;
  setInvoiceShowPicker: React.Dispatch<React.SetStateAction<boolean>>;
  invoiceBtnRef: React.RefObject<HTMLButtonElement | null>;
  invoicePickPos: { top: number; right: number };
  setInvoicePickPos: React.Dispatch<React.SetStateAction<{ top: number; right: number }>>;
  missClickToast: boolean;
  setMissClickToast: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
}

export default function ProductFormModal(props: ProductFormModalProps) {
  const { t } = useTranslation();
  const {
    form, setForm, editing, formKey, error,
    batchRows, addBatchRow, updateBatchRow, confirmDeleteBatch,
    deleteBatchConfirm, setDeleteBatchConfirm, removeBatchRow,
    suppliers, setSuppliers,
    supplierSearch, setSupplierSearch, supplierDropdownOpen, setSupplierDropdownOpen,
    recentSuppliers, setRecentSuppliers,
    handleAddUnit, handleDeleteUnit, showUnitForm, setShowUnitForm, unitForm, setUnitForm, units,
    handleSubmit, resetForm, loading,
    isSimpleType, isBottleMedicine, isBandageType, isGeneralType,
    user, deleting, editingPurchaseUuid, editingBatchUuid,
    products, setDeleteConfirm,
    showNewPurchase, setShowNewPurchase,
    newSupplierSearch, setNewSupplierSearch, newSupplierDropdownOpen, setNewSupplierDropdownOpen,
    newInvoiceNumber, setNewInvoiceNumber, newInvoiceDate, setNewInvoiceDate,
    newInvoiceShowPicker, setNewInvoiceShowPicker, newInvoiceBtnRef, newInvoicePickPos, setNewInvoicePickPos,
    newPurchaseDiscount, setNewPurchaseDiscount,
    manualSubtotal, setManualSubtotal, newManualSubtotal, setNewManualSubtotal,
    newPurchaseBatchIds, setNewPurchaseBatchIds, newPurchaseBatchOpen, setNewPurchaseBatchOpen,
    mfgShowPicker, setMfgShowPicker, mfgPickPos, setMfgPickPos, mfgBtnRef,
    expiryShowPicker, setExpiryShowPicker, expiryPickPos, setExpiryPickPos, expiryBtnRef,
    batchDatePicker, setBatchDatePicker,
    invoiceShowPicker, setInvoiceShowPicker, invoiceBtnRef, invoicePickPos, setInvoicePickPos,
    missClickToast, setMissClickToast, onClose,
  } = props;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) { setMissClickToast(true); setTimeout(() => setMissClickToast(false), 2000); } }}>
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-900/20 w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">{editing ? t('products.editProduct') : form.name.trim() ? form.name : t('products.quickAddProduct')}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{editing ? t('products.updateMedicineInfo') : t('products.addProductManually')}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <div key={formKey} className="flex-1 overflow-y-auto p-5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-slate-400">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="col-span-2">
                  <Input label={t('products.medicineName')} required value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder={t('products.nameExample')} />
                </div>
                <div className="col-span-2">
                  <Dropdown label={t('products.category')} options={CATEGORY_OPTIONS.map(c => ({ value: c.uuid, label: c.name }))} value={form.category_uuid} onChange={(uuid: string) => {
                    setForm({ ...form, category_uuid: uuid });
                    const dflt = CATEGORY_DEFAULTS[uuid];
                    if (dflt) {
                      setForm((prev: any) => ({
                        ...prev,
                        category_uuid: uuid,
                        schedule_type: prev.schedule_type || dflt.schedule,
                        prescription_required: prev.prescription_required ?? dflt.prescription,
                      }));
                    }
                  }} />
                </div>
                <div className="col-span-2">
                  <Input label={t('products.composition')} value={form.composition} onChange={(e: any) => setForm(prev => ({ ...prev, composition: e.target.value }))} placeholder={t('products.compositionExample')} />
                </div>
                <div className="col-span-2">
                  <Input label={t('products.description')} value={form.description || ""} onChange={(e: any) => setForm({ ...form, description: e.target.value })} placeholder={t('products.descriptionOptional')} />
                </div>
                <Input label={t('products.manufacturer')} value={form.manufacturer} onChange={(e: any) => setForm({ ...form, manufacturer: e.target.value })} placeholder={t('products.manufacturerExample')} />
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.gstRate')}</label>
                  <Select value={form.gst_percent} onChange={(v: string) => setForm({ ...form, gst_percent: v })} options={GST_OPTIONS} placeholder={t('products.selectGst')} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.schedule')}</label>
                  <Select value={form.schedule_type} onChange={(v: string) => setForm({ ...form, schedule_type: v })} options={SCHEDULE_TYPES} />
                </div>
                <Input label={t('products.hsnCode')} value={form.hsn_code} onChange={(e: any) => setForm({ ...form, hsn_code: e.target.value })} placeholder={t('products.hsnExample')} />
                <Input label={t('products.barcode')} value={form.barcode} onChange={(e: any) => setForm({ ...form, barcode: e.target.value })} placeholder={t('products.barcodeExample')} />
                <Input label={t('products.sku')} value={form.sku} onChange={(e: any) => setForm({ ...form, sku: e.target.value })} placeholder={t('products.skuOptional')} />
                <Input label={t('products.rackLocation')} value={form.rack_location} onChange={(e: any) => setForm({ ...form, rack_location: e.target.value })} placeholder={t('products.rackExample')} />
                <div className="flex items-end pb-1">
                  <Toggle checked={form.prescription_required} onChange={(v: boolean) => setForm({ ...form, prescription_required: v })} label={t('products.prescriptionRequired')} />
                </div>

                {/* Package Section */}
                {!isSimpleType && (
                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.package')}</div>
                  <div className="mb-4">
                    <Dropdown label={t('products.productType')} options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} />
                  </div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <Input label={t('products.boxEquals')} type="number" value={form.boxes} onChange={(e: any) => {
                      const newBoxes = e.target.value;
                      const spb = Number(newBoxes) || 1;
                      const stripsVal = String(spb * (Number(form.strips_per_box) || 0));
                      const tps = Number(form.tablets_per_strip) || 0;
                      const tabletVal = String((Number(stripsVal) || 0) * tps + (Number(form.extra_tablets) || 0));
                      setForm({ ...form, boxes: newBoxes, strips: stripsVal, total_tablets: tabletVal });
                    }} placeholder="0" />
                    <Input label={isBottleMedicine ? t('products.boxBottles') : (isBandageType || isGeneralType) ? "1 box = pack" : t('products.boxStrips')} type="number" value={form.strips_per_box} onChange={(e: any) => {
                      const newSpb = e.target.value;
                      const spb = Number(newSpb) || 0;
                      const stripsVal = String((Number(form.boxes) || 1) * spb);
                      const tps = Number(form.tablets_per_strip) || 0;
                      const tabletVal = String((Number(stripsVal) || 0) * tps + (Number(form.extra_tablets) || 0));
                      setForm({ ...form, strips_per_box: newSpb, strips: stripsVal, total_tablets: tabletVal });
                    }} placeholder="0" />
                    <Input label={isBottleMedicine ? t('products.bottleTablets') : isBandageType ? "1 pack = bandages" : isGeneralType ? "1 pack = pieces" : t('products.stripTablets')} type="number" value={form.tablets_per_strip} onChange={(e: any) => {
                      const newTps = e.target.value;
                      const tps = Number(newTps) || 0;
                      const tabletVal = String((Number(form.strips) || 0) * tps + (Number(form.extra_tablets) || 0));
                      setForm({ ...form, tablets_per_strip: newTps, total_tablets: tabletVal });
                    }} placeholder="0" />
                    <Input label={isBandageType ? "Extra bandages" : isGeneralType ? "Extra pieces" : t('products.extraTablets')} type="number" value={form.extra_tablets} onChange={(e: any) => {
                      const newEt = e.target.value;
                      const tabletVal = String((Number(form.strips) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(newEt) || 0));
                      setForm({ ...form, extra_tablets: newEt, total_tablets: tabletVal });
                    }} placeholder="0" />
                  </div>
                  <div className="mt-3 space-y-2">
                    <div className="px-4 py-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">{(isBandageType || isGeneralType) ? "Total Packs" : t('products.totalStrips')}</span>
                      <span className="text-lg font-bold text-blue-600">
                        {batchRows.reduce((s: number, r: BatchRow) => s + (Number(r.strips) || 0), 0) + (Number(form.strips) || 0)}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 bg-slate-50 rounded-xl flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">{isBandageType ? "Total Bandages" : isGeneralType ? "Total Pieces" : t('products.totalTablets')}</span>
                      <span className="text-lg font-bold text-emerald-600">
                        {batchRows.reduce((s: number, r: BatchRow) => s + (Number(r.total_tablets) || 0), 0) + (Number(form.total_tablets) || 0)}
                      </span>
                    </div>
                  </div>
                </div>
                )}

                {/* Simple type fields */}
                {isSimpleType && (
                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="mb-4">
                    <Dropdown label={t('products.productType')} options={UNIT_OPTIONS.map(u => ({ value: u, label: u }))} value={form.unit} onChange={(v: string) => setForm({ ...form, unit: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Input label={t('products.pricePerProduct')} prefix="₹" type="number" value={form.price_per_tablet} onChange={(e: any) => setForm({ ...form, price_per_tablet: e.target.value })} placeholder="0" />
                    <Input label={t('products.totalStock')} type="number" value={form.total_tablets} onChange={(e: any) => { const v = e.target.value; setForm({ ...form, total_tablets: v, strips: String(Math.round((Number(v) || 0) / ((Number(form.tablets_per_strip) || 0) || 1))) }); }} placeholder="0" />
                  </div>
                </div>
                )}

                {/* Pricing Section */}
                {!isSimpleType && (
                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.pricing')}</div>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                    <Input label={t('products.pricePerBox')} prefix="₹" type="number" value={form.price_per_box} onChange={(e: any) => setForm({ ...form, price_per_box: e.target.value })} placeholder="0" />
                    <Input label={isBottleMedicine ? t('products.pricePerBottle') : (isBandageType || isGeneralType) ? "Price per pack" : t('products.pricePerStrip')} prefix="₹" type="number" value={form.price_per_strip} onChange={(e: any) => setForm({ ...form, price_per_strip: e.target.value })} placeholder="0" />
                    <Input label={isBandageType ? "Price per bandage" : isGeneralType ? "Price per piece" : t('products.pricePerTablet')} prefix="₹" type="number" value={form.price_per_tablet} onChange={(e: any) => setForm({ ...form, price_per_tablet: e.target.value })} placeholder="0" />
                  </div>
                </div>
                )}

                <div className="col-span-2">
                  <hr className="border-slate-200 my-4" />
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.batches')}</div>
                  <div className="space-y-3">
                    <div className="border border-slate-200 rounded-xl p-4 bg-white">
                      <div className={`grid ${isSimpleType ? "grid-cols-2" : "grid-cols-3"} gap-x-4 gap-y-3`}>
                        <Input label={t('products.batchNo')} value={form.batch_number} onChange={(e: any) => setForm({ ...form, batch_number: e.target.value })} placeholder="e.g. B001" />
                        {isBottleMedicine && (
                          <Input label={t('products.bottles')} type="number" value={form.bottles} onChange={(e: any) => {
                            const b = Number(e.target.value) || 0;
                            const tps = Number(form.tablets_per_strip) || 1;
                            const newTotal = String(b * tps);
                            setForm({ ...form, bottles: e.target.value, total_tablets: newTotal, strips: String(b) });
                          }} placeholder="0" />
                        )}
                        {!isSimpleType && !isBottleMedicine && (
                          <Input label={(isBandageType || isGeneralType) ? "Packs" : t('products.strips')} type="number" value={form.strips} onChange={(e: any) => {
                            const s = Number(e.target.value) || 0;
                            const tps = Number(form.tablets_per_strip) || 1;
                            setForm({ ...form, strips: e.target.value, total_tablets: String(s * tps) });
                          }} placeholder="0" />
                        )}
                        <Input label={isSimpleType ? t('products.totalProductsSimple') : isBandageType ? "Total Bandages" : isGeneralType ? "Total Pieces" : t('products.totalTablets')} type="number" value={form.total_tablets} className={!isSimpleType && ((Number(form.total_tablets) || 0) + batchRows.reduce((s: number, r: BatchRow) => s + (Number(r.total_tablets) || 0), 0)) > ((Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(form.extra_tablets) || 0)) ? "border-red-400 focus:ring-red-500/20 focus:border-red-400" : ""} onChange={(e: any) => { setForm({ ...form, total_tablets: e.target.value, strips: String(Math.round((Number(e.target.value) || 0) / ((Number(form.tablets_per_strip) || 0) || 1))), bottles: String(Math.floor((Number(e.target.value) || 0) / ((Number(form.tablets_per_strip) || 0) || 1))) }); }} placeholder="0" />
                        <Input label={t('products.ptr')} type="number" step="0.01" value={form.ptr} onChange={(e: any) => setForm({ ...form, ptr: e.target.value })} placeholder="0.00" />
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.mfgDate')}</label>
                          <div className="relative">
                            <button
                              ref={mfgBtnRef}
                              type="button"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                setMfgPickPos({ top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                setMfgShowPicker(!mfgShowPicker);
                              }}
                              className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                            >
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                              <span>{form.manufacture_date ? format(new Date(form.manufacture_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                            </button>
                            {mfgShowPicker && (
                              <div id="mfg-cal-popup" className="fixed z-[70]" style={{ top: mfgPickPos.top, right: mfgPickPos.right }}>
                                <SimpleDatePicker date={form.manufacture_date ? new Date(form.manufacture_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, manufacture_date: format(d, "yyyy-MM-dd") }); setMfgShowPicker(false); }} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.expiryDate')}</label>
                          <div className="relative">
                            <button
                              ref={expiryBtnRef}
                              type="button"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                setExpiryPickPos({ top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                setExpiryShowPicker(!expiryShowPicker);
                              }}
                              className="flex h-10 w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                            >
                              <CalendarIcon className="w-4 h-4 text-slate-400" />
                              <span>{form.expiry_date ? format(new Date(form.expiry_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                            </button>
                            {expiryShowPicker && (
                              <div id="expiry-cal-popup" className="fixed z-[70]" style={{ top: expiryPickPos.top, right: expiryPickPos.right }}>
                                <SimpleDatePicker date={form.expiry_date ? new Date(form.expiry_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, expiry_date: format(d, "yyyy-MM-dd") }); setExpiryShowPicker(false); }} disableFuture={false} />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {batchRows.map((row, idx) => (
                      <div key={row.id} className="border border-slate-200 rounded-xl p-4 bg-white relative">
                        <button
                          type="button"
                          onClick={(e) => confirmDeleteBatch(e, row.id)}
                          disabled={user?.role !== 'admin'}
                          className="absolute -top-2 -right-2 w-7 h-7 bg-red-50 border border-red-200 rounded-full flex items-center justify-center text-red-500 hover:bg-red-100 text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <div className={`grid ${isSimpleType ? "grid-cols-2" : "grid-cols-3"} gap-x-4 gap-y-3`}>
                          <Input label={t('products.batchNo')} value={row.batch_number} onChange={(e: any) => updateBatchRow(row.id, "batch_number", e.target.value)} placeholder="e.g. B002" />
                          {isBottleMedicine && (
                            <Input label={t('products.bottles')} type="number" value={row.bottles} onChange={(e: any) => updateBatchRow(row.id, "bottles", e.target.value)} placeholder="0" />
                          )}
                          {!isSimpleType && !isBottleMedicine && (
                            <Input label={(isBandageType || isGeneralType) ? "Packs" : t('products.strips')} type="number" value={row.strips} onChange={(e: any) => updateBatchRow(row.id, "strips", e.target.value)} placeholder="0" />
                          )}
                          <Input label={isSimpleType ? t('products.totalProductsSimple') : isBandageType ? "Total Bandages" : isGeneralType ? "Total Pieces" : t('products.totalTablets')} type="number" value={row.total_tablets} className={!isSimpleType && ((Number(form.total_tablets) || 0) + batchRows.slice(0, idx).reduce((s: number, r: BatchRow) => s + (Number(r.total_tablets) || 0), 0) + (Number(row.total_tablets) || 0)) > ((Number(form.boxes) || 1) * (Number(form.strips_per_box) || 0) * (Number(form.tablets_per_strip) || 0) + (Number(form.extra_tablets) || 0)) ? "border-red-400 focus:ring-red-500/20 focus:border-red-400" : ""} onChange={(e: any) => updateBatchRow(row.id, "total_tablets", e.target.value)} placeholder="0" />
                          <Input label={t('products.ptr')} type="number" step="0.01" value={row.ptr} onChange={(e: any) => updateBatchRow(row.id, "ptr", e.target.value)} placeholder="0.00" />
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.mfgDate')}</label>
                            <div className="relative">
                              <button
                                type="button"
                                className="batch-date-btn flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                onClick={(e) => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                  setBatchDatePicker({ id: row.id, field: 'mfg', top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                }}
                              >
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span>{row.manufacture_date ? format(new Date(row.manufacture_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.expiryDate')}</label>
                            <div className="relative">
                              <button
                                type="button"
                                className="batch-date-btn flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                onClick={(e) => {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                                  setBatchDatePicker({ id: row.id, field: 'exp', top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                                }}
                              >
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span>{row.expiry_date ? format(new Date(row.expiry_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addBatchRow}
                    disabled={user?.role !== 'admin'}
                    className="mt-3 w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                    {t('products.addBatch')}
                  </button>
                </div>

                {/* Image */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.image')}</label>
                  {form.image ? (
                    <div className="relative">
                      <img src={form.image} alt="Preview" className="w-full h-28 object-contain rounded-xl border border-slate-200 bg-slate-50" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, image: "" })}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-full shadow hover:bg-red-50 hover:text-red-600 text-slate-400 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById("product-image-input")?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files[0];
                        if (f && f.type.startsWith("image/")) {
                          try {
                            const dataUrl = await compressImage(f);
                            setForm({ ...form, image: dataUrl });
                          } catch { /* ignore */ }
                        }
                      }}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
                    >
                      <svg className="w-10 h-10 mx-auto text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-slate-500 font-medium">{t('products.clickOrDrag')}</p>
                      <p className="text-xs text-slate-400 mt-1">{t('products.supportedFormats')}</p>
                      <input
                        id="product-image-input"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (f && f.type.startsWith("image/")) {
                            try {
                              const dataUrl = await compressImage(f);
                              setForm({ ...form, image: dataUrl });
                            } catch { /* ignore */ }
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

                {/* Purchase Details */}
                {editing ? (
                  <>
                    <hr className="border-slate-200 my-4" />
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('products.purchaseDetails')}</div>
                      {!showNewPurchase && (
                        <button
                          type="button"
                          disabled={user?.role !== 'admin'}
                          onClick={() => {
                            setNewSupplierSearch("");
                            setNewSupplierDropdownOpen(false);
                            setShowNewPurchase(true);
                            const newIds = batchRows.filter(r => !r.batch_uuid).map(r => r.id);
                            setNewPurchaseBatchIds(newIds);
                          }}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 border border-emerald-300 hover:border-emerald-400 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-emerald-600 disabled:hover:border-emerald-300"
                        >
                          {t('products.addNewDetails')}
                        </button>
                      )}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm text-slate-700">
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.supplier')}</span><span>{supplierSearch || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.invoiceNo')}</span><span>{form.invoice_number || "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.invoiceDate')}</span><span>{form.invoice_date ? format(new Date(form.invoice_date + "T00:00:00"), "dd MMM yyyy") : "-"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">{t('products.discount')}</span><span>₹{Number(form.purchase_discount || 0).toFixed(2)}</span></div>
                      <div className="flex justify-between border-t border-slate-200 pt-2 mt-1"><span className="font-medium">{t('products.subtotal')}</span><span className="font-bold text-emerald-600">₹{Number(form.purchase_total || 0).toFixed(2)}</span></div>
                    </div>
                    {showNewPurchase && (
                      <>
                        <hr className="border-slate-200 my-4" />
                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t('products.newPurchaseDetails')}</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                          <div className="relative">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.supplier')}</label>
                            <input
                              type="text"
                              value={newSupplierSearch}
                              onChange={(e) => { setNewSupplierSearch(e.target.value); setNewSupplierDropdownOpen(true); if (!e.target.value) setForm({ ...form, supplier_uuid: "" }); }}
                              onFocus={() => setNewSupplierDropdownOpen(true)}
                              placeholder={t('products.searchOrTypeSupplier')}
                              className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                            />
                            {newSupplierDropdownOpen && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => { setNewSupplierDropdownOpen(false); }} />
                                <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ position: 'absolute' }}>
                                  <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                    {!newSupplierSearch.trim() ? (
                                      recentSuppliers.length > 0 ? (
                                        <>
                                          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('products.recentSuppliers')}</div>
                                          {recentSuppliers.map((s) => (
                                            <button
                                              key={s.supplier_uuid}
                                              type="button"
                                              onClick={() => {
                                                setForm({ ...form, supplier_uuid: s.supplier_uuid });
                                                setNewSupplierSearch(s.name);
                                                setNewSupplierDropdownOpen(false);
                                              }}
                                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between text-slate-700"
                                            >
                                              <span>{s.name}</span>
                                              {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                                            </button>
                                          ))}
                                          <div className="px-4 py-2.5 text-xs text-slate-400 border-t border-slate-100 text-center">{t('products.typeToSearchAll')}</div>
                                        </>
                                      ) : (
                                        <div className="px-4 py-6 text-center text-sm text-slate-400">{t('products.typeToSearch')}</div>
                                      )
                                    ) : (
                                      <>
                                        {suppliers.filter(s => s.name.toLowerCase().includes(newSupplierSearch.toLowerCase())).length === 0 ? (
                                          <div className="px-4 py-6 text-center text-sm text-slate-400">{t('products.noSuppliersFound')}</div>
                                        ) : (
                                          suppliers.filter(s => s.name.toLowerCase().includes(newSupplierSearch.toLowerCase())).map((s) => (
                                            <button
                                              key={s.supplier_uuid}
                                              type="button"
                                              onClick={() => {
                                                setForm({ ...form, supplier_uuid: s.supplier_uuid });
                                                setNewSupplierSearch(s.name);
                                                setNewSupplierDropdownOpen(false);
                                                try {
                                                  const stored = localStorage.getItem("recent_suppliers");
                                                  let uuids: string[] = stored ? JSON.parse(stored) : [];
                                                  uuids = [s.supplier_uuid, ...uuids.filter((id) => id !== s.supplier_uuid)].slice(0, 10);
                                                  localStorage.setItem("recent_suppliers", JSON.stringify(uuids));
                                                  setRecentSuppliers((prev) => {
                                                    const next = [s, ...prev.filter((r) => r.supplier_uuid !== s.supplier_uuid)].slice(0, 10);
                                                    return next;
                                                  });
                                                } catch (e) {}
                                              }}
                                              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                                                form.supplier_uuid === s.supplier_uuid ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700"
                                              }`}
                                            >
                                              <span>{s.name}</span>
                                              {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                                            </button>
                                          ))
                                        )}
                                        {!suppliers.some(s => s.name.toLowerCase() === newSupplierSearch.trim().toLowerCase()) && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                const created = await createSupplier({ name: newSupplierSearch.trim() });
                                                setForm({ ...form, supplier_uuid: created.supplier_uuid || created.uuid });
                                                setNewSupplierSearch(newSupplierSearch.trim());
                                                setNewSupplierDropdownOpen(false);
                                                setSuppliers(prev => [...prev, created]);
                                              } catch (e) { console.error(e); }
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 font-medium border-t border-slate-100 flex items-center gap-2"
                                          >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                            {t('products.addAsNewSupplier', { name: newSupplierSearch.trim() })}
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          <Input label={t('products.invoiceNumber')} value={newInvoiceNumber} onChange={(e: any) => setNewInvoiceNumber(e.target.value)} placeholder="e.g. INV-001" />
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.invoiceDate')}</label>
                            <div className="relative">
                              <button
                                ref={newInvoiceBtnRef}
                                type="button"
                                onClick={() => {
                                  if (newInvoiceBtnRef.current) {
                                    const r = newInvoiceBtnRef.current.getBoundingClientRect();
                                    setNewInvoicePickPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
                                  }
                                  setNewInvoiceShowPicker(!newInvoiceShowPicker);
                                }}
                                className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                              >
                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                <span>{newInvoiceDate ? format(new Date(newInvoiceDate + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                              </button>
                              {newInvoiceShowPicker && (
                                <div id="new-inv-cal-popup" className="fixed z-[70]" style={{ top: newInvoicePickPos.top, right: newInvoicePickPos.right }}>
                                  <SimpleDatePicker date={newInvoiceDate ? new Date(newInvoiceDate + "T00:00:00") : undefined} onSelect={(d) => { setNewInvoiceDate(format(d, "yyyy-MM-dd")); setNewInvoiceShowPicker(false); }} />
                                </div>
                              )}
                            </div>
                          </div>
                          <Input label={t('products.supplierDiscount')} type="number" value={newPurchaseDiscount} onChange={(e: any) => { setNewPurchaseDiscount(e.target.value); setNewManualSubtotal(null); }} placeholder="0" />
                          <div className="col-span-2">
                            <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Select Batches</label>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setNewPurchaseBatchOpen(!newPurchaseBatchOpen)}
                                className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                              >
                                <span>{newPurchaseBatchIds.length} batch{newPurchaseBatchIds.length !== 1 ? "es" : ""} selected</span>
                                <svg className={`w-4 h-4 text-slate-400 transition-transform ${newPurchaseBatchOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </button>
                              {newPurchaseBatchOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setNewPurchaseBatchOpen(false)} />
                                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ position: 'absolute' }}>
                                    <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                      {(() => {
                                        const options: { id: string; batch_number: string; strips: string; total_tablets: string; ptr: string; isNew: boolean }[] = [];
                                        if (form.batch_number || form.strips) {
                                          options.push({ id: 'form-batch', batch_number: form.batch_number || "-", strips: form.strips, total_tablets: form.total_tablets, ptr: form.ptr, isNew: !editingBatchUuid });
                                        }
                                        for (const row of batchRows) {
                                          if (row.batch_number) {
                                            options.push({ id: row.id, batch_number: row.batch_number, strips: row.strips, total_tablets: row.total_tablets, ptr: row.ptr, isNew: !row.batch_uuid });
                                          }
                                        }
                                        if (options.length === 0) {
                                          return <div className="px-4 py-6 text-center text-sm text-slate-400">No batches available</div>;
                                        }
                                        return options.map((opt) => (
                                          <label
                                            key={opt.id}
                                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={newPurchaseBatchIds.includes(opt.id)}
                                              onChange={() => {
                                                setNewPurchaseBatchIds(prev =>
                                                  prev.includes(opt.id)
                                                    ? prev.filter(id => id !== opt.id)
                                                    : [...prev, opt.id]
                                                );
                                              }}
                                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
                                            />
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm text-slate-800 font-medium">{opt.batch_number}</div>
                                              <div className="text-xs text-slate-400">{opt.total_tablets} tablets · ₹{opt.ptr} PTR{opt.isNew ? <span className="text-emerald-500 ml-1">new</span> : ""}</div>
                                            </div>
                                          </label>
                                        ));
                                      })()}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        {(() => {
                          const displayValue = newManualSubtotal !== null ? newManualSubtotal : "";
                          return (
                            <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-200 mt-4">
                              <span className="text-sm font-medium text-slate-600">{t('products.subtotal')}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-slate-400">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={displayValue}
                                  onChange={(e) => setNewManualSubtotal(e.target.value)}
                                  onWheel={(e) => { e.preventDefault(); (e.target as HTMLElement).blur(); }}
                                  placeholder="0"
                                  className="w-32 text-right bg-transparent border-b border-slate-300 text-2xl font-bold text-emerald-600 focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                />
                              </div>
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewPurchase(false);
                            setNewSupplierSearch("");
                            setNewPurchaseBatchIds([]);
                            setNewInvoiceNumber("");
                            setNewInvoiceDate("");
                            setNewPurchaseDiscount("");
                            setNewManualSubtotal(null);
                            setNewPurchaseBatchIds([]);
                          }}
                          className="mt-2 text-xs text-slate-400 hover:text-slate-600 underline"
                        >
                          {t('products.cancelNewDetails')}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                <>
                  <hr className="border-slate-200 my-4" />
                  <div className="border border-slate-200 rounded-xl p-5 bg-white">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">{t('products.purchaseDetails')}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="relative">
                        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.supplier')}</label>
                        <input
                          type="text"
                          value={supplierSearch}
                          onChange={(e) => { setSupplierSearch(e.target.value); setSupplierDropdownOpen(true); if (!e.target.value) setForm({ ...form, supplier_uuid: "" }); }}
                          onFocus={() => setSupplierDropdownOpen(true)}
                          placeholder={t('products.searchOrTypeSupplier')}
                          className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                        />
                        {supplierDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => { setSupplierDropdownOpen(false); }} />
                            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden" style={{ position: 'absolute' }}>
                              <div className="max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && !supplierSearch.trim() ? (
                                  <div className="px-4 py-6 text-center text-sm text-slate-400">Type to search suppliers</div>
                                ) : (
                                  <>
                                    {suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase())).map((s) => (
                                      <button
                                        key={s.supplier_uuid}
                                        type="button"
                                        onClick={() => {
                                          setForm({ ...form, supplier_uuid: s.supplier_uuid });
                                          setSupplierSearch(s.name);
                                          setSupplierDropdownOpen(false);
                                          try {
                                            const stored = localStorage.getItem("recent_suppliers");
                                            let uuids: string[] = stored ? JSON.parse(stored) : [];
                                            uuids = [s.supplier_uuid, ...uuids.filter((id) => id !== s.supplier_uuid)].slice(0, 10);
                                            localStorage.setItem("recent_suppliers", JSON.stringify(uuids));
                                            setRecentSuppliers((prev) => {
                                              const next = [s, ...prev.filter((r) => r.supplier_uuid !== s.supplier_uuid)].slice(0, 10);
                                              return next;
                                            });
                                          } catch (e) {}
                                        }}
                                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${
                                          form.supplier_uuid === s.supplier_uuid ? "bg-emerald-50 text-emerald-700 font-medium" : "text-slate-700"
                                        }`}
                                      >
                                        <span>{s.name}</span>
                                        {s.phone && <span className="text-xs text-slate-400">+91 {s.phone}</span>}
                                      </button>
                                    ))}
                                    {supplierSearch.trim() && !suppliers.some(s => s.name.toLowerCase() === supplierSearch.trim().toLowerCase()) && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const created = await createSupplier({ name: supplierSearch.trim() });
                                            setForm({ ...form, supplier_uuid: created.supplier_uuid || created.uuid });
                                            setSupplierSearch(supplierSearch.trim());
                                            setSupplierDropdownOpen(false);
                                            setSuppliers(prev => [...prev, created]);
                                          } catch (e) { console.error(e); }
                                        }}
                                        className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 font-medium border-t border-slate-100 flex items-center gap-2"
                                      >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                        {t('products.addAsNewSupplier', { name: supplierSearch.trim() })}
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                      <Input label={t('products.invoiceNumber')} value={form.invoice_number} onChange={(e: any) => setForm({ ...form, invoice_number: e.target.value })} placeholder="e.g. INV-001" />
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">{t('products.invoiceDate')}</label>
                        <div className="relative">
                          <button
                            ref={invoiceBtnRef}
                            type="button"
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const fitsBelow = rect.bottom + 4 + 300 <= window.innerHeight;
                              setInvoicePickPos({ top: fitsBelow ? rect.bottom + 4 : rect.top - 300, right: document.documentElement.clientWidth - rect.right });
                              setInvoiceShowPicker(!invoiceShowPicker);
                            }}
                            className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                          >
                            <CalendarIcon className="w-4 h-4 text-slate-400" />
                            <span>{form.invoice_date ? format(new Date(form.invoice_date + "T00:00:00"), "dd MMM yyyy") : t('products.pickDate')}</span>
                          </button>
                          {invoiceShowPicker && (
                            <div id="inv-cal-popup" className="fixed z-[70]" style={{ top: invoicePickPos.top, right: invoicePickPos.right }}>
                              <SimpleDatePicker date={form.invoice_date ? new Date(form.invoice_date + "T00:00:00") : undefined} onSelect={(d) => { setForm({ ...form, invoice_date: format(d, "yyyy-MM-dd") }); setInvoiceShowPicker(false); }} />
                            </div>
                          )}
                        </div>
                      </div>
                      <Input label={t('products.supplierDiscount')} type="number" value={form.purchase_discount} onChange={(e: any) => { setForm({ ...form, purchase_discount: e.target.value }); setManualSubtotal(null); }} placeholder="0" />
                    </div>
                    {(() => {
                      const displayValue = manualSubtotal !== null ? manualSubtotal : "";
                      return (
                        <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center border border-slate-200 mt-4">
                          <span className="text-sm font-medium text-slate-600">Subtotal</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">₹</span>
                            <input
                              type="number"
                              step="0.01"
                              value={displayValue}
                              onChange={(e) => setManualSubtotal(e.target.value)}
                              placeholder="0"
                              onWheel={(e) => { e.preventDefault(); (e.target as HTMLElement).blur(); }}
                              className="w-32 text-right bg-transparent border-b border-slate-300 text-2xl font-bold text-emerald-600 focus:outline-none focus:border-emerald-500 placeholder:text-slate-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
                )}
              {editing && (
                <div className="border-2 border-dashed border-red-300 rounded-xl p-4 bg-red-50/50 mt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">{t('products.dangerZone')}</p>
                  </div>
                  <p className="text-xs text-red-600 mb-3">{t('products.deleteWarning')}</p>
                  <button
                    onClick={() => {
                      const uuid = editing.product_uuid || editing.uuid;
                      const product = products.find((p: any) => p.product_uuid === uuid);
                      setDeleteConfirm({ uuid, name: product?.name || t('products.thisProduct') });
                    }}
                    disabled={user?.role !== 'admin' || deleting === (editing.product_uuid || editing.uuid)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    {deleting === (editing.product_uuid || editing.uuid) ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                    {deleting === (editing.product_uuid || editing.uuid) ? t('products.deletingEllipsis') : t('products.deleteProduct')}
                  </button>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-50"
              >
                {loading && <Spinner size="sm" />}
                {loading ? (editing ? t('products.updatingEllipsis') : t('products.creatingEllipsis')) : editing ? t('products.updateProduct') : t('products.createProduct')}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {missClickToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-xl text-sm text-amber-800 bg-amber-50 border border-amber-200 shadow-lg animate-pulse">
          Safety miss-click activated — use ✕ button to close
        </div>
      )}
    </>
  );
}
