import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import SimpleDatePicker from "../SimpleDatePicker";
import type { Product } from "./constants";
import {
  GST_OPTIONS, SCHEDULE_TYPES,
} from "./constants";
import { Badge, Spinner, Tooltip } from "./ui";
import ImportSupplierInvoiceModal from "../../components/ImportSupplierInvoiceModal";
import BatchInfoModal from "./BatchInfoModal";
import {
  Select as ShadSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";

interface BatchInfoItem {
  hasBatches: boolean;
  batchCount: number;
  totalAvailable: number;
  nearestExpiry: string | null;
  nearestExpiryDays: number | null;
  hasExpiredStock: boolean;
  expiredCount: number;
}

function formatCompactNumber(num: number): string {
  const absNum = Math.abs(num);
  if (absNum >= 10000000) return (num / 10000000).toFixed(2) + "cr";
  if (absNum >= 100000) return (num / 100000).toFixed(2) + "L";
  if (absNum >= 1000) return (num / 1000).toFixed(2) + "k";
  return String(num);
}

interface ProductListViewProps {
  products: Product[];
  filteredProducts: Product[];
  paginatedProducts: Product[];
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  stockFilter: "all" | "in" | "low" | "out" | "expired";
  setStockFilter: React.Dispatch<React.SetStateAction<"all" | "in" | "low" | "out" | "expired">>;
  sortField: string;
  sortDir: "asc" | "desc";
  handleSort: (field: string) => void;
  selectedRows: Set<string>;
  toggleRow: (uuid: string) => void;
  toggleAll: () => void;
  user: any;
  handleEdit: (p: any) => void;
  setDeleteConfirm: React.Dispatch<React.SetStateAction<any>>;
  handleQuarantineExpired: () => void;
  showFilters: boolean;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  filters: any;
  setFilters: React.Dispatch<React.SetStateAction<any>>;
  filterFromDate: Date | undefined;
  setFilterFromDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  filterToDate: Date | undefined;
  setFilterToDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  filterFromShowPicker: boolean;
  setFilterFromShowPicker: React.Dispatch<React.SetStateAction<boolean>>;
  filterToShowPicker: boolean;
  setFilterToShowPicker: React.Dispatch<React.SetStateAction<boolean>>;
  filterFromPickPos: { top: number; right: number };
  setFilterFromPickPos: React.Dispatch<React.SetStateAction<{ top: number; right: number }>>;
  filterToPickPos: { top: number; right: number };
  setFilterToPickPos: React.Dispatch<React.SetStateAction<{ top: number; right: number }>>;
  filterFromBtnRef: React.RefObject<HTMLButtonElement | null>;
  filterToBtnRef: React.RefObject<HTMLButtonElement | null>;
  batchInfo: Record<string, BatchInfoItem>;
  loadBatchInfo: (product_uuid: string) => Promise<void>;
  expiredProductUuids: Set<string>;
  pageP: number;
  setPageP: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  pageSize: number;
  showStats: boolean;
  setSelectedStat: React.Dispatch<React.SetStateAction<string | null>>;
  totalProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalInventoryValue: number;
  showImport: boolean;
  setShowImport: React.Dispatch<React.SetStateAction<boolean>>;
  getProductBatches: (product_uuid: string) => Promise<any[]>;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  resetForm: () => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setFormKey: React.Dispatch<React.SetStateAction<number>>;
  hasActiveFilters: boolean;
  setAllBatchesMap: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onImported: () => void;
  quarantining: boolean;
}

export default function ProductListView(props: ProductListViewProps) {
  const { t } = useTranslation();
  const [batchModalProduct, setBatchModalProduct] = useState<{ product_uuid: string; batches: any[] } | null>(null);

  const {
    products, filteredProducts, paginatedProducts,
    searchTerm, setSearchTerm,
    stockFilter, setStockFilter,
    sortField, sortDir, handleSort,
    selectedRows, toggleRow, toggleAll,
    user, handleEdit, setDeleteConfirm,
    handleQuarantineExpired,
    showFilters, setShowFilters, filters, setFilters,
    filterFromDate, setFilterFromDate, filterToDate, setFilterToDate,
    filterFromShowPicker, setFilterFromShowPicker, filterToShowPicker, setFilterToShowPicker,
    filterFromPickPos, setFilterFromPickPos, filterToPickPos, setFilterToPickPos,
    filterFromBtnRef, filterToBtnRef,
    batchInfo, loadBatchInfo,
    expiredProductUuids,
    pageP, setPageP, totalPages, pageSize,
    showStats, setSelectedStat,
    totalProducts, lowStockProducts, outOfStockProducts, totalInventoryValue,
    showImport, setShowImport,
    getProductBatches,
    setShowForm, resetForm, setError, setFormKey,
    hasActiveFilters, setAllBatchesMap,
    onImported,
    quarantining,
  } = props;

  const SortIcon = ({ field }: { field: string }) => (
    <svg
      className={`w-3 h-3 ml-1 transition-colors ${sortField === field ? "text-blue-500" : "text-slate-300"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      {sortField === field && sortDir === "asc" ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      )}
    </svg>
  );

  const pickerHeight = 280;

  return (
    <>
      {/* Stats Cards */}
      {showStats && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 text-start">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
            <button onClick={() => setSelectedStat('products')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </button>
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
              <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.totalProducts')}</p>
              <p className="text-5xl font-bold text-gray-900 leading-none">{totalProducts}</p>
              <p className="text-xs text-gray-500 mt-1">{t('products.allRegisteredMedicines')}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
            <button onClick={() => setSelectedStat('inventory')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </button>
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
              <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.inventoryValue')}</p>
              <p className="text-5xl font-bold text-gray-900 leading-none">₹{formatCompactNumber(totalInventoryValue)}</p>
              <p className="text-xs text-gray-500 mt-1">{t('products.currentStockValue')}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
            <button onClick={() => setSelectedStat('low')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </button>
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
              <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.lowStock')}</p>
              <p className="text-5xl font-bold text-gray-900 leading-none">{lowStockProducts}</p>
              <p className="text-xs text-gray-500 mt-1">{t('products.itemsNeedReordering')}</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex items-center gap-6 relative">
            <button onClick={() => setSelectedStat('out')} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17L17 7M7 7h10v10" />
              </svg>
            </button>
            <div className="flex-shrink-0">
              <p className="text-xs text-gray-400 mb-0.5">{t('products.statistics')}</p>
              <p className="text-sm font-semibold text-gray-700 mb-3">{t('products.outOfStock')}</p>
              <p className="text-5xl font-bold text-gray-900 leading-none">{outOfStockProducts}</p>
              <p className="text-xs text-gray-500 mt-1">{t('products.requiresImmediateAction')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Products Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm shadow-slate-100">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t("products.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all shrink-0 border ${
              hasActiveFilters
                ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-900/20"
                : "bg-white text-slate-700 border-slate-200 hover:border-green-400 hover:text-green-600"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {t('products.filter')}
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-white inline-block" />
            )}
          </button>
          <button
            onClick={() => {
              resetForm();
              setError(null);
              setFormKey(k => k + 1);
              setShowForm(true);
            }}
            disabled={user?.role !== 'admin'}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-green-900/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t("products.addProduct")}
          </button>
          <button
            onClick={() => setShowImport(true)}
            disabled={user?.role !== 'admin'}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-emerald-900/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            Import
          </button>
          <Tooltip label={t('products.quarantineExpired')}>
            <button
              onClick={handleQuarantineExpired}
              disabled={user?.role !== 'admin' || quarantining}
              className="p-2.5 rounded-xl border border-slate-200 bg-white transition-all text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-40"
            >
              {quarantining ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              )}
            </button>
          </Tooltip>
          <ShadSelect value={stockFilter} onValueChange={(val) => setStockFilter(val as any)}>
            <SelectTrigger className="max-w-[150px] bg-white border-slate-200 rounded-xl focus:outline-none focus:ring-0">
              <SelectValue placeholder={t('products.filterByStock')} />
            </SelectTrigger>
            <SelectContent className="bg-white border-slate-200 rounded-xl overflow-hidden mt-1 font-medium">
              <SelectItem value="all" className="px-4 py-2.5 text-slate-700 focus:bg-slate-50 cursor-pointer">{t('products.allProducts')}</SelectItem>
              <SelectItem value="in" className="px-4 py-2.5 text-emerald-700 focus:bg-emerald-50 cursor-pointer">{t('products.inStock')}</SelectItem>
              <SelectItem value="low" className="px-4 py-2.5 text-amber-700 focus:bg-amber-50 cursor-pointer">{t('products.lowStock')}</SelectItem>
              <SelectItem value="out" className="px-4 py-2.5 text-red-700 focus:bg-red-50 cursor-pointer">{t('products.outOfStock')}</SelectItem>
              <SelectItem value="expired" className="px-4 py-2.5 text-red-700 focus:bg-red-50 cursor-pointer">Expired</SelectItem>
            </SelectContent>
          </ShadSelect>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.dateFrom')}</label>
                <div className="relative">
                  <button
                    ref={filterFromBtnRef}
                    type="button"
                    onClick={() => setFilterFromShowPicker(!filterFromShowPicker)}
                    className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  >
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span>{filterFromDate ? format(filterFromDate, "dd MMM yyyy") : t('products.pickDate')}</span>
                  </button>
                  {filterFromShowPicker && (
                    <div id="filter-from-cal-popup" className="fixed z-[70]" style={{ top: filterFromPickPos.top, right: filterFromPickPos.right }}>
                      <SimpleDatePicker date={filterFromDate} onSelect={(d) => { setFilterFromDate(d); setFilterFromShowPicker(false); }} />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.dateTo')}</label>
                <div className="relative">
                  <button
                    ref={filterToBtnRef}
                    type="button"
                    onClick={() => setFilterToShowPicker(!filterToShowPicker)}
                    className="flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  >
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span>{filterToDate ? format(filterToDate, "dd MMM yyyy") : t('products.pickDate')}</span>
                  </button>
                  {filterToShowPicker && (
                    <div id="filter-to-cal-popup" className="fixed z-[70]" style={{ top: filterToPickPos.top, right: filterToPickPos.right }}>
                      <SimpleDatePicker date={filterToDate} onSelect={(d) => { setFilterToDate(d); setFilterToShowPicker(false); }} />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.composition')}</label>
                <input type="text" value={filters.composition} onChange={(e) => setFilters(prev => ({ ...prev, composition: e.target.value }))} placeholder={t('products.compositionExample')}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.batch')}</label>
                <input type="text" value={filters.batch} onChange={(e) => setFilters(prev => ({ ...prev, batch: e.target.value }))} placeholder={t('products.batchPlaceholder')}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.schedule')}</label>
                <ShadSelect value={filters.schedule} onValueChange={(v) => setFilters(prev => ({ ...prev, schedule: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-white border-slate-200 rounded-xl focus:outline-none focus:ring-0">
                    <SelectValue placeholder={t('products.all')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-xl">
                    <SelectItem value="all">{t('products.all')}</SelectItem>
                    {SCHEDULE_TYPES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </ShadSelect>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.gstPercent')}</label>
                <ShadSelect value={filters.gst} onValueChange={(v) => setFilters(prev => ({ ...prev, gst: v === "all" ? "" : v }))}>
                  <SelectTrigger className="bg-white border-slate-200 rounded-xl focus:outline-none focus:ring-0">
                    <SelectValue placeholder={t('products.all')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 rounded-xl">
                    <SelectItem value="all">All</SelectItem>
                    {GST_OPTIONS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </ShadSelect>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{t('products.mrpRange')}</label>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={filters.mrpMin} onChange={(e) => setFilters(prev => ({ ...prev, mrpMin: e.target.value }))} placeholder={t('products.min')} className="w-full px-2 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
                  <span className="text-slate-400 text-xs">-</span>
                  <input type="number" value={filters.mrpMax} onChange={(e) => setFilters(prev => ({ ...prev, mrpMax: e.target.value }))} placeholder={t('products.max')} className="w-full px-2 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400 placeholder:text-slate-400" />
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={() => { setFilters({ dateFrom: "", dateTo: "", composition: "", schedule: "", gst: "", mrpMin: "", mrpMax: "", batch: "" }); setFilterFromDate(undefined); setFilterToDate(undefined); setAllBatchesMap({}); }}
                className="text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors px-3 py-1.5 rounded-lg shadow-sm">
                {t('products.clearAllFilters')}
              </button>
            </div>
          </div>
        )}

        {/* Bulk Action Bar */}
        {selectedRows.size > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 bg-blue-50 border-b border-blue-100">
            <span className="text-sm font-medium text-blue-700">{selectedRows.size} {t('products.selected')}</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setDeleteConfirm({ count: selectedRows.size })}
                disabled={user?.role !== 'admin'}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('products.deleteTitle')}
              </button>
              <button onClick={() => setSelectedRows(new Set())} className="p-1.5 text-slate-400 hover:text-slate-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <Table className="min-w-[650px] lg:min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200">
                <TableHead className="w-10 text-left">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === filteredProducts.length && filteredProducts.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                </TableHead>
                {[
                  { field: "name", label: t('products.tableProduct'), sortable: true, align: "left" },
                  { field: "composition", label: t('products.tableComposition'), sortable: true, align: "left" },
                  { field: "schedule_type", label: t('products.tableSchedule'), sortable: false, align: "left" },
                  { field: "gst_percent", label: t('products.tableGst'), sortable: false, align: "left" },
                  { field: "price", label: t('products.tableMrp'), sortable: true, align: "right" },
                  { field: "stock", label: t('products.tableStock'), sortable: true, align: "right" },
                  { field: "batches", label: "Batches", sortable: false, align: "left" },
                  { field: "status", label: t('products.tableStatus'), sortable: false, align: "center" },
                ].map(({ field, label, sortable, align }) => (
                  <TableHead
                    key={field}
                    onClick={sortable ? () => handleSort(field) : undefined}
                    className={`text-[11px] font-semibold text-slate-500 uppercase tracking-wider ${sortable ? "cursor-pointer hover:text-slate-700 select-none" : ""
                      } ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
                  >
                    <div className={`flex items-center ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
                      {label}
                      {sortable && <SortIcon field={field} />}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{t('products.tableActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <svg className="w-14 h-14 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-base font-medium text-slate-400">{t('products.noProductsFound')}</p>
                      <p className="text-sm text-slate-300">{t('products.tryAdjustingSearch')}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((p) => {
                  const batchInfoItem = batchInfo[p.product_uuid];
                  const isNearExpiry = batchInfoItem?.nearestExpiryDays !== null && batchInfoItem?.nearestExpiryDays <= 10 && batchInfoItem?.nearestExpiryDays > 0;
                  const isOutOfStock = p.stock === 0;
                  const isLowStock = p.stock > 0 && p.stock <= 10;
                  const isSelected = selectedRows.has(p.product_uuid);
                  return (
                    <TableRow key={p.product_uuid} className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${isSelected ? "bg-blue-50/60" : ""}`}>
                      <TableCell className="w-10 text-left">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(p.product_uuid)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="font-semibold text-sm text-slate-800 truncate">{p.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {p.manufacturer && <span className="text-xs text-slate-400 truncate max-w-[120px]">{p.manufacturer}</span>}
                          {p.medicine_type && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{p.medicine_type}</span>}
                          {p.rack_location && <span className="text-[10px] text-blue-500 font-mono font-medium">{p.rack_location}</span>}
                          {isNearExpiry && (
                            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              {t('products.expiresIn', { days: batchInfoItem.nearestExpiryDays })}
                            </span>
                          )}
                          {batchInfoItem?.hasExpiredStock && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                              {batchInfoItem.expiredCount} {t('products.expired')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-left max-w-[160px]">
                        <span className="text-xs text-slate-500 italic line-clamp-2">{p.composition || "—"}</span>
                      </TableCell>
                      <TableCell className="text-left">
                        {p.schedule_type && p.schedule_type !== "NONE" ? (
                          <Badge variant="schedule">Sch {p.schedule_type}</Badge>
                        ) : (
                          <Badge variant="otc">OTC</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        <span className="text-xs font-mono text-slate-500">{p.gst_percent || 0}%</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-sm text-slate-800">₹{p.price?.toLocaleString()}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-semibold text-sm ${isOutOfStock ? "text-red-500" : isLowStock ? "text-amber-600" : "text-slate-700"}`}>
                            {p.stock ?? 0}
                          </span>
                          <span className="text-xs text-slate-400">{p.unit === "General" ? "Pieces" : `${p.unit}s`}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        {batchInfoItem && batchInfoItem.hasBatches ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-xs font-medium text-slate-700">{batchInfoItem.batchCount} batch{batchInfoItem.batchCount !== 1 ? "es" : ""}</span>
                              <button
                                onClick={async (e) => { e.stopPropagation(); const data = await getProductBatches(p.product_uuid); setBatchModalProduct({ product_uuid: p.product_uuid, batches: data }); }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                title="View batches"
                              >
                                <HugeiconsIcon icon={InformationCircleIcon} size={17} />
                              </button>
                            </div>
                            {batchInfoItem.nearestExpiryDays !== null && batchInfoItem.nearestExpiryDays <= 10 && (
                              <span className="text-[10px] text-red-500 font-medium">
                                Exp in {batchInfoItem.nearestExpiryDays}d
                              </span>
                            )}
                            {batchInfoItem.hasExpiredStock && (
                              <span className="text-[10px] text-red-500 font-medium">{batchInfoItem.expiredCount} expired</span>
                            )}
                          </div>
                        ) : batchInfoItem && batchInfoItem.hasExpiredStock ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="inline-flex items-center gap-1">
                              <span className="text-xs font-medium text-red-600">{batchInfoItem.expiredCount} expired</span>
                              <button
                                onClick={async (e) => { e.stopPropagation(); const data = await getProductBatches(p.product_uuid); setBatchModalProduct({ product_uuid: p.product_uuid, batches: data }); }}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                                title="View batches"
                              >
                                <HugeiconsIcon icon={InformationCircleIcon} size={17} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">–</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {expiredProductUuids.has(p.product_uuid) ? (
                          <Badge variant="danger">Expired</Badge>
                        ) : isOutOfStock ? (
                          <Badge variant="danger">{t('products.outOfStockLabel')}</Badge>
                        ) : isLowStock ? (
                          <Badge variant="warning">{t('products.lowStockLabel')}</Badge>
                        ) : (
                          <Badge variant="success">{t('products.inStockLabel')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip label={t('products.editTitle')}>
                            <button
                              onClick={() => {
                                handleEdit(p);
                                loadBatchInfo(p.product_uuid);
                              }}
                              disabled={user?.role !== 'admin'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                              {t('products.editTitle')}
                            </button>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        {filteredProducts.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-400">{t('products.showingProducts', { start: (pageP - 1) * pageSize + 1, end: Math.min(pageP * pageSize, filteredProducts.length), total: filteredProducts.length })}</p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPageP(p => Math.max(1, p - 1))}
                  disabled={pageP === 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('products.prev')}
                </button>
                {(() => {
                  const pages: (number | string)[] = [];
                  const range = 2;
                  for (let i = 1; i <= totalPages; i++) {
                    if (i === 1 || i === totalPages || (i >= pageP - range && i <= pageP + range)) {
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
                        onClick={() => setPageP(p as number)}
                        className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                          p === pageP
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
                  onClick={() => setPageP(p => Math.min(totalPages, p + 1))}
                  disabled={pageP === totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('products.next')}
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-400 rounded-full" />{t('products.inStockLabel')}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-amber-400 rounded-full" />{t('products.lowStockLabel')}</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-400 rounded-full" />{t('products.outOfStockLabel')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Import Supplier Invoice Modal */}
      {showImport && (
        <ImportSupplierInvoiceModal
          onClose={() => setShowImport(false)}
          onImported={onImported}
        />
      )}

      {/* Batch Info Modal */}
      {batchModalProduct && (
        <BatchInfoModal
          batches={batchModalProduct.batches}
          onClose={() => setBatchModalProduct(null)}
        />
      )}
    </>
  );
}
