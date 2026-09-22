import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Remove01Icon,
  Delete01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
import { getProductUnits, getProductBatches, searchProducts } from "../../../renderer/services/productApi";

interface CartItem {
  id: number;
  product_uuid: string;
  unit_uuid: string;
  batch_uuid?: string;
  quantity: number;
  price: number;
  discount: number;
  tax_percent: number;
  free_quantity?: number;
  product: {
    name: string;
    barcode?: string;
    sku?: string;
    manufacturer?: string;
    medicine_type?: string;
    schedule_type?: string;
    prescription_required?: number;
    purchase_price?: number;
    image?: string;
  };
}

interface CartItemsProps {
  items: CartItem[];
  onIncrease: (item: CartItem) => void;
  onDecrease: (item: CartItem) => void;
  onRemove?: (item: CartItem) => void;
  onUpdateQty?: (item: CartItem, quantity: number) => void;
  onUpdateField?: (item: CartItem, fields: { quantity?: number; price?: number; discount?: number; tax_percent?: number }) => void;
  onChangeBatch?: (item: CartItem, batchUuid: string) => void;
  onChangeUnit?: (item: CartItem, unitUuid: string) => void;
  onSelectRow?: (item: CartItem | null) => void;
}

// Compact dark dropdown matching the invoice grid (native selects draw OS chrome)
function GridPicker({ value, options, onPick }: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const listRef = useRef<HTMLDivElement>(null);

  // Arrow keys move inside the open list; Enter activates natively.
  const moveInList = (dir: 1 | -1) => {
    const btns = Array.from(
      listRef.current?.querySelectorAll('button') ?? []
    ) as HTMLElement[];
    if (btns.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const i = active ? btns.indexOf(active) : -1;
    const next = dir === 1 ? Math.min(i + 1, btns.length - 1) : Math.max(i - 1, 0);
    btns[next]?.focus();
  };

  return (
    <div className="relative">
      <button
        data-cell="uom"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onKeyDown={(e) => {
          // While open, arrows jump into the option list instead of the grid.
          if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            e.stopPropagation();
            moveInList(e.key === 'ArrowDown' ? 1 : -1);
          }
        }}
        className="max-w-full w-full overflow-hidden flex items-center gap-1 bg-white border border-gray-300 rounded-none px-1.5 py-0.5 text-xs text-gray-800 hover:border-gray-400 focus:outline-none focus:border-green-500"
      >
        <span className="truncate">{current?.label || '—'}</span>
        <span className="text-gray-500 text-[9px]">▾</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          />
          <div
            ref={listRef}
            data-uom-list
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                moveInList(e.key === 'ArrowDown' ? 1 : -1);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            className="absolute left-0 top-full mt-0.5 z-50 w-40 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-none shadow"
          >
            {options.map((o) => (
              <button
                key={o.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setOpen(false); if (o.value !== value) onPick(o.value); }}
                className={`w-full text-left px-2 py-1.5 text-xs border-b border-gray-200 last:border-b-0 ${o.value === value ? 'bg-blue-50 text-gray-900' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function CartItems({
  items,
  onIncrease,
  onDecrease,
  onRemove,
  onUpdateQty,
  onUpdateField,
  onChangeBatch,
  onChangeUnit,
  onSelectRow,
}: CartItemsProps) {
  const { t } = useTranslation();

  useEffect(() => {
    console.log("🛒 CartItems received items update:", items);
    console.log("🛒 Number of items:", items.length);
  }, [items]);

  const [qtyDraft, setQtyDraft] = useState<Record<number, string>>({});
  const [cellDraft, setCellDraft] = useState<Record<string, string>>({});
  const prevCountRef = useRef(items.length);
  const lastFocusRef = useRef<{ rowId: string; cell: string } | null>(null);
  const [pq, setPq] = useState('');
  const [pResults, setPResults] = useState<any[]>([]);
  const [pSearching, setPSearching] = useState(false);
  const [editRow, setEditRow] = useState<number | null>(null);
  const [editField, setEditField] = useState<'code' | 'name'>('code');

  // Inline product-search cell shared by the Code and Name entry cells,
  // so billing can start from either field. Typing searches the existing
  // catalog, Enter picks the highlight into a new invoice row.
  const renderEntryInput = (e: number, field: 'code' | 'name', placeholder: string) => (
    <div className="relative w-full max-w-full overflow-visible">
      <input
        ref={(el) => { inputRefs.current[`pq-${e}-${field}`] = el; }}
        data-cell={field}
        value={editRow === e && editField === field ? pq : ''}
        placeholder={placeholder}
        onChange={(ev) => { setEditRow(e); setEditField(field); setActiveRow(`empty-${e}`); setPq(ev.target.value); }}
        onFocus={() => { setEditRow(e); setEditField(field); setActiveRow(`empty-${e}`); }}
        onBlur={() => setTimeout(() => { setEditRow((cur) => (cur === e ? null : cur)); }, 150)}
        onKeyDown={(ev) => {
          ev.stopPropagation();
          if (ev.key === 'ArrowDown' && pResults.length > 0) { ev.preventDefault(); setPIdx((i) => Math.min(i + 1, pResults.length - 1)); }
          else if (ev.key === 'ArrowUp' && pResults.length > 0) { ev.preventDefault(); setPIdx((i) => Math.max(i - 1, 0)); }
          else if (ev.key === 'Enter' && editRow === e && editField === field && pResults.length > 0) { ev.preventDefault(); requestAddProduct(pResults[Math.min(pIdx, pResults.length - 1)]); }
          else if (ev.key === 'Escape') { setPq(''); setEditRow(null); (ev.target as HTMLInputElement).blur(); }
        }}
        className="w-full bg-transparent text-gray-900 placeholder-gray-400 px-1 py-0.5 rounded-none text-xs focus:outline-none focus:bg-gray-50 focus:ring-1 focus:ring-green-500"
      />
      {editRow === e && editField === field && pq.trim().length >= 2 && (
        <div className="absolute left-0 top-full mt-0.5 z-50 w-72 max-h-56 overflow-y-auto bg-white border border-gray-300 rounded-none shadow">
          {pSearching ? (
            <div className="px-2 py-2 text-gray-500 text-xs">Searching…</div>
          ) : pResults.length === 0 ? (
            <div className="px-2 py-2 text-gray-500 text-xs">{t('pos.noProductsFound')}</div>
          ) : (
            pResults.map((p: any, i: number) => (
              <div
                key={p.product_uuid}
                onMouseDown={(me) => { me.preventDefault(); requestAddProduct(p); }}
                onMouseEnter={() => setPIdx(i)}
                className={`px-2 py-1.5 cursor-pointer border-b border-gray-200 ${i === pIdx ? 'bg-blue-50' : ''}`}
              >
                <div className="font-semibold text-gray-900 text-xs truncate">{p.name}</div>
                <div className="text-gray-500 text-[10px] truncate">
                  {[p.sku, p.barcode, p.manufacturer].filter(Boolean).join(' • ')}{p.price != null ? ` • ₹${p.price}` : ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
  const [pIdx, setPIdx] = useState(0);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [rowInfo, setRowInfo] = useState<Record<string, { unit?: string; batchNo?: string; expiry?: string; units?: Array<{ unit_uuid: string; unit_name: string; conversion_factor: number; price?: number }>; batches?: Array<{ batch_uuid: string; batch_number: string; expiry_date: string; quantity: number }> }>>({});
  const [activeRow, setActiveRow] = useState<number | string | null>(null);
  const [batchOpenFor, setBatchOpenFor] = useState<number | null>(null);

  // Enrich rows with unit / batch display data using the existing product APIs
  useEffect(() => {
    let cancelled = false;
    const missing = items.filter((item) => {
      const key = `${item.product_uuid}|${item.unit_uuid || ''}`;
      return !rowInfo[key];
    });
    missing.forEach(async (item) => {
      const key = `${item.product_uuid}|${item.unit_uuid || ''}`;
      try {
        const [units, batches] = await Promise.all([
          getProductUnits(item.product_uuid),
          getProductBatches(item.product_uuid),
        ]);
        if (cancelled) return;
        const unitList = Array.isArray(units) ? units : [];
        const batchList = Array.isArray(batches) ? batches : [];
        const unit = unitList.find((x: any) => x.unit_uuid === item.unit_uuid)
          || unitList.find((x: any) => x.is_base_unit)
          || unitList[0];
        const batch = batchList.find((b: any) => b.batch_uuid === (item as any).batch_uuid);
        const availBatches = batchList
          .filter((b: any) => (b.quantity || 0) > 0)
          .map((b: any) => ({
            batch_uuid: b.batch_uuid,
            batch_number: b.batch_number,
            expiry_date: b.expiry_date,
            quantity: b.quantity || 0,
          }))
          .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
        setRowInfo((prev) => ({
          ...prev,
          [key]: {
            unit: (item as any).unit_name || unit?.unit_name,
            units: unitList.map((x: any) => ({
              unit_uuid: x.unit_uuid,
              unit_name: x.unit_name,
              conversion_factor: x.conversion_factor,
              price: x.price,
            })),
            batches: availBatches,
          },
        }));
      } catch {
        if (!cancelled) setRowInfo((prev) => ({ ...prev, [key]: {} }));
      }
    });
    return () => { cancelled = true; };
  }, [items]);

  const commitQty = (item: CartItem) => {
    const draft = qtyDraft[item.id];
    if (draft === undefined) return;
    const n = parseInt(draft, 10);
    setQtyDraft((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    if (!isNaN(n) && n >= 1 && n !== item.quantity && onUpdateQty) {
      onUpdateQty(item, n);
    }
  };

  // Debounced product lookup for the in-grid product cell (existing search API)
  useEffect(() => {
    const q = pq.trim();
    if (editRow === null || q.length < 2) {
      setPResults([]);
      return;
    }
    let cancelled = false;
    setPSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchProducts(q);
        if (!cancelled) {
          setPResults(Array.isArray(res) ? res.slice(0, 8) : []);
          setPIdx(0);
        }
      } catch {
        if (!cancelled) setPResults([]);
      } finally {
        if (!cancelled) setPSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pq, editRow]);

  // After any add, focus the new row's name cell so the Enter chain
  // (name → uom → qty → free → batch → next line) starts immediately.
  useEffect(() => {
    if (items.length > prevCountRef.current) {
      const last = items[items.length - 1];
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-cell="name"][data-row="${last.id}"]`) as HTMLElement | null;
        console.log('[GRID] new-row focus:', last.id, el ? 'FOUND' : 'MISSING');
        el?.focus();
      });
    }
    prevCountRef.current = items.length;
  }, [items]);

  // New session / reload: start with the first Code cell focused so the
  // green highlight is always present and billing can begin by typing.
  useEffect(() => {
    const t = setTimeout(() => {
      setActiveRow('empty-0');
      (document.querySelector('tbody [data-cell="code"]') as HTMLElement | null)?.focus();
    }, 300);
    return () => clearTimeout(t);
  }, []);
  // If a cart refresh dropped keyboard focus entirely (activeElement fell
  // back to <body>), put it back on the last-used row + cell — if it still
  // exists. Never steals focus the cashier moved deliberately elsewhere.
  useEffect(() => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && ae !== document.body) return;
    const lf = lastFocusRef.current;
    if (!lf) return;
    const nameEl = document.querySelector(
      `[data-cell="name"][data-row="${lf.rowId}"]`
    );
    const row = nameEl?.closest('tr');
    const target =
      (row?.querySelector(`[data-cell="${lf.cell}"]`) as HTMLElement | null) ??
      (nameEl as HTMLElement | null);
    if (target) {
      console.log('[GRID] focus restored:', lf.rowId, lf.cell);
      target.focus();
    }
  }, [items]);

  // Forward the chosen product to the existing quick-add entry workflow.
  // selectProduct focuses the main search field once the row is added.
  const requestAddProduct = (product: any) => {
    if (!product?.product_uuid) return;
    setPq('');
    setPResults([]);
    setEditRow(null);
    window.dispatchEvent(new CustomEvent('pos-add-product', { detail: { product, fromGrid: true } }));
  };

  // Commit a Rate / GST% / Discount / Free cell edit through the existing update API
  const commitCell = (item: CartItem, field: 'price' | 'discount' | 'tax_percent' | 'free_quantity') => {
    const key = `${item.id}:${field}`;
    const draft = cellDraft[key];
    if (draft === undefined) return;
    setCellDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    const raw = field === 'free_quantity' ? parseInt(draft, 10) : parseFloat(draft);
    if (isNaN(raw) || raw < 0) return;
    const n = field === 'free_quantity' ? Math.floor(raw) : raw;
    if (field === 'tax_percent' && n > 100) return;
    const current = field === 'price' ? item.price : field === 'discount' ? (item.discount || 0) : field === 'free_quantity' ? (item.free_quantity || 0) : item.tax_percent;
    if (n === current || !onUpdateField) return;
    onUpdateField(item, { [field]: n });
  };

  const fmtExp = (d?: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  // Spreadsheet: filled rows first, then always-visible empty entry rows
  const EMPTY_ROWS = 20;
  const th = "font-semibold px-2 py-2 border border-gray-300 whitespace-nowrap";
  const td = "px-2 py-1.5 whitespace-nowrap border border-gray-200";

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse table-fixed text-xs leading-snug min-w-[1240px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-gray-100 text-gray-700">
            <th className={`text-left ${th} w-10`}>S.No</th>
            <th className={`text-left ${th} w-20 text-left`}>Drug Code</th>
            <th className={`text-left ${th} w-64 max-w-64 text-left`}>Drug Name</th>
            <th className={`text-left ${th} w-20`}>UOM</th>
            <th className={`text-center ${th} w-28`}>Qty</th>
            <th className={`text-center ${th} w-14`}>Free</th>
            <th className={`text-left ${th} w-28`}>Batch</th>
            <th className={`text-left ${th} w-20`}>Expiry</th>
            <th className={`text-center ${th} w-20`}>Price</th>
            <th className={`text-center ${th} w-20`}>Rate</th>
            <th className={`text-center ${th} w-12`}>GST%</th>
            <th className={`text-center ${th} w-16`}>GST Amt</th>
            <th className={`text-center ${th} w-16`}>Disc</th>
            <th className={`text-center ${th} w-20`}>Value</th>
          </tr>
        </thead>
        <tbody
          onFocusCapture={(e) => {
            // Remember where the cashier is: after any cart refresh that
            // drops focus, we put it back on the same row + cell.
            const t = e.target as HTMLElement;
            const cell = t.closest?.('[data-cell]');
            const row = t.closest?.('tr');
            const nameEl = row?.querySelector('[data-cell="name"]');
            const rowId = nameEl?.getAttribute('data-row');
            if (cell && rowId) {
              lastFocusRef.current = {
                rowId,
                cell: cell.getAttribute('data-cell') || '',
              };
            }
          }}
        >
          {items.map((item, index) => {
            const subtotal = item.price * item.quantity;
            const taxAmount =
              ((item.price * item.quantity - (item.discount || 0)) *
                item.tax_percent) /
              100;
            const value = subtotal - (item.discount || 0) + taxAmount;
            const info = rowInfo[`${item.product_uuid}|${item.unit_uuid || ''}`] || {};
            const selBatch = (info.batches || []).find((b) => b.batch_uuid === (item as any).batch_uuid);
            const selBatchNo = selBatch?.batch_number || (item as any).batch_number;
            const selExpiry = selBatch?.expiry_date || (item as any).batch_expiry_date;
            const isActive = activeRow === item.id;

            return (
              <tr
                key={`${item.product_uuid}_${item.unit_uuid || index}`}
                tabIndex={0}
                onClick={() => { setActiveRow(item.id); onSelectRow?.(item); }}
                onKeyDown={(ev) => {
                  const row = ev.currentTarget as HTMLTableRowElement;
                  if ((ev.target as HTMLElement).tagName === 'INPUT') return;
                  // An open option list owns its keys (arrows/Enter/Escape).
                  if ((ev.target as HTMLElement).closest('[data-uom-list],[data-batch-list]')) return;
                  // Arrows on an open batch picker jump into its options.
                  if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && batchOpenFor === item.id && (ev.target as HTMLElement).closest('[data-cell="batch"]')) {
                    ev.preventDefault();
                    const btns = Array.from(row.querySelectorAll('[data-batch-list] button')) as HTMLElement[];
                    if (btns.length) btns[ev.key === 'ArrowDown' ? 0 : btns.length - 1].focus();
                    return;
                  }
                  if (ev.key === 'ArrowDown') { ev.preventDefault(); (row.nextElementSibling as HTMLElement | null)?.focus(); }
                  else if (ev.key === 'ArrowUp') { ev.preventDefault(); (row.previousElementSibling as HTMLElement | null)?.focus(); }
                  else if (ev.key === 'Enter') {
                    // Cell-to-cell flow: name → uom → qty → free → batch → next line.
                    // Expiry/Price/Rate/GST/Disc/Value are display-only and skipped.
                    ev.preventDefault();
                    const cells = Array.from(row.querySelectorAll('[data-cell]')) as HTMLElement[];
                    const cur = (ev.target as HTMLElement).closest('[data-cell]');
                    const idx = cur ? cells.indexOf(cur as HTMLElement) : -1;
                    console.log('[GRID] nav from', (cur as HTMLElement | null)?.getAttribute?.('data-cell'), 'idx', idx, 'of', cells.length);
                    if (idx >= 0 && idx < cells.length - 1) {
                      cells[idx + 1].focus();
                    } else {
                      const nextRow = row.nextElementSibling as HTMLElement | null;
                      const nextTarget = nextRow?.querySelector('[data-cell="code"], [data-cell="name"]') as HTMLElement | null;
                      if (nextTarget) nextTarget.focus();
                    }
                  }
                }}
                className={`text-gray-800 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-green-500 ${isActive ? 'bg-blue-50 shadow-[inset_2px_0_0_0_#16a34a]' : 'hover:bg-gray-50'}`}
              >
                <td className={`${td} text-gray-500`}>{index + 1}</td>
                <td
                  className={`${td} max-w-[80px] overflow-hidden text-ellipsis text-gray-500 text-left`}
                  title={item.product?.sku || item.product?.barcode || ''}
                >
                  <span className="block truncate">
                    {item.product?.sku || item.product?.barcode || '—'}
                  </span>
                </td>
                <td
                  className={`${td} max-w-[256px] overflow-hidden text-ellipsis text-left`}
                  title={(item.product?.name || '').replace('[Custom] ', '')}
                >
                  <span
                    className="font-semibold text-gray-900 focus:outline-none focus:bg-blue-100"
                    tabIndex={0}
                    data-cell="name"
                    data-row={item.id}
                  >
                    {(item.product?.name || t('pos.unknownProduct')).replace('[Custom] ', '')}
                  </span>
                  {item.product?.manufacturer && (
                    <span className="ml-1.5 text-gray-500">{item.product.manufacturer}</span>
                  )}
                  {item.product?.prescription_required ? (
                    <span className="ml-1.5 text-[9px] bg-red-500 text-white px-1 rounded-none font-medium">Rx</span>
                  ) : null}
                  {item.product?.schedule_type && item.product.schedule_type !== 'NONE' && (
                    <span className="ml-1 text-[9px] bg-yellow-600 text-white px-1 rounded-none font-medium">
                      {item.product.schedule_type}
                    </span>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => {
                        onRemove(item);
                      }}
                      className="ml-1.5 text-red-500 hover:text-red-700 align-middle"
                      title="Remove"
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="text-xs" />
                    </button>
                  )}
                </td>
                <td className={`${td} text-gray-600`}>
                  {info.units && info.units.length > 1 && onChangeUnit ? (
                    <GridPicker
                      value={item.unit_uuid || ''}
                      options={info.units.map((u) => ({ value: u.unit_uuid, label: u.unit_name }))}
                      onPick={(v) => onChangeUnit(item, v)}
                    />
                  ) : (info.unit || '—')}
                </td>
                <td className={`${td}`}>
                  <div className="flex items-center justify-center gap-0.5">
                    <button
                      onClick={() => onDecrease(item)}
                      className="w-5 h-5 flex items-center justify-center text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-none transition-colors"
                    >
                      <HugeiconsIcon icon={Remove01Icon} className="text-[10px]" />
                    </button>
                    <input
                      ref={(el) => { inputRefs.current[`qty-${item.id}`] = el; }}
                      data-cell="qty"
                      value={qtyDraft[item.id] ?? String(item.quantity)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d+$/.test(v)) {
                          setQtyDraft((prev) => ({ ...prev, [item.id]: v }));
                        }
                      }}
                      onBlur={() => commitQty(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          commitQty(item);
                          const row = (e.target as HTMLElement).closest('tr');
                          (row?.querySelector('[data-cell="free"]') as HTMLElement | null)?.focus();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 px-1 py-1 text-center text-xs font-semibold text-gray-900 bg-white border border-gray-300 rounded-none focus:outline-none focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => onIncrease(item)}
                      className="w-5 h-5 flex items-center justify-center text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-none transition-colors"
                    >
                      <HugeiconsIcon icon={Add01Icon} className="text-[10px]" />
                    </button>
                  </div>
                </td>
                <td className={`${td}`}>
                  <input
                    data-cell="free"
                    value={cellDraft[`${item.id}:free_quantity`] ?? String(item.free_quantity ?? 0)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d+$/.test(v)) {
                        setCellDraft((prev) => ({ ...prev, [`${item.id}:free_quantity`]: v }));
                      }
                    }}
                    onBlur={() => commitCell(item, 'free_quantity')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitCell(item, 'free_quantity');
                        const row = (e.target as HTMLElement).closest('tr');
                        (row?.querySelector('[data-cell="batch"]') as HTMLElement | null)?.focus();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-11 px-1 py-0.5 text-center text-xs text-gray-700 bg-white border border-gray-300 rounded-none focus:outline-none focus:bg-gray-50 focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </td>
                <td className={`${td} text-gray-600`}>
                  {info.batches && info.batches.length > 1 && onChangeBatch ? (
                    <div className="relative">
                      <button
                        data-cell="batch"
                        onClick={(e) => { e.stopPropagation(); setBatchOpenFor((cur) => (cur === item.id ? null : item.id)); }}
                        className="max-w-full w-full overflow-hidden flex items-center gap-1 bg-white border border-gray-300 rounded-none px-1.5 py-0.5 text-xs text-gray-800 hover:border-gray-400 focus:outline-none focus:border-green-500"
                        title="Switch batch"
                      >
                        <span className="truncate">{selBatchNo || 'Select'}</span>
                        <span className="text-gray-500 text-[9px]">▾</span>
                      </button>
                      {batchOpenFor === item.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => { e.stopPropagation(); setBatchOpenFor(null); }}
                          />
                          <div
                            data-batch-list
                            onKeyDown={(e) => {
                              // Own the arrows while open so the row below doesn't steal them.
                              e.stopPropagation();
                              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                e.preventDefault();
                                const btns = Array.from(e.currentTarget.querySelectorAll('button')) as HTMLElement[];
                                const i = btns.indexOf(document.activeElement as HTMLElement);
                                const n = e.key === 'ArrowDown' ? Math.min(i + 1, btns.length - 1) : Math.max(i - 1, 0);
                                btns[n]?.focus();
                              } else if (e.key === 'Escape') {
                                setBatchOpenFor(null);
                                const cell = (e.currentTarget as HTMLElement).closest('td');
                                (cell?.querySelector('[data-cell="batch"]') as HTMLElement | null)?.focus();
                              }
                            }}
                            className="absolute left-0 top-full mt-0.5 z-50 w-56 max-h-48 overflow-y-auto bg-white border border-gray-300 rounded-none shadow"
                          >
                            {info.batches.map((b) => {
                              const selected = b.batch_uuid === (item as any).batch_uuid;
                              return (
                                <button
                                  key={b.batch_uuid}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { setBatchOpenFor(null); if (!selected) onChangeBatch(item, b.batch_uuid); }}
                                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-xs border-b border-gray-200 last:border-b-0 focus:outline-none focus:bg-blue-100 focus:text-gray-900 ${selected ? 'bg-blue-50 text-gray-900' : 'text-gray-600 hover:bg-blue-50'}`}
                                >
                                  <span className="font-semibold truncate">{b.batch_number}</span>
                                  <span className="text-gray-500 whitespace-nowrap">{fmtExp(b.expiry_date)} • {b.quantity}</span>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (selBatchNo || '—')}
                </td>
                <td className={`${td} text-gray-500`}>{fmtExp(selExpiry)}</td>
                <td className={`${td} text-center text-gray-500`}>
                  {item.product?.purchase_price ? `₹${Number(item.product.purchase_price).toFixed(2)}` : '—'}
                </td>
                <td className={`${td} text-center text-gray-900`}>
                  <input
                    value={cellDraft[`${item.id}:price`] ?? item.price.toFixed(2)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d*\.?\d*$/.test(v)) {
                        setCellDraft((prev) => ({ ...prev, [`${item.id}:price`]: v }));
                      }
                    }}
                    onBlur={() => commitCell(item, 'price')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { commitCell(item, 'price'); (e.target as HTMLInputElement).blur(); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-16 px-1 py-0.5 text-center text-xs text-gray-900 bg-white border border-gray-300 rounded-none focus:outline-none focus:bg-gray-50 focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </td>
                <td className={`${td} text-center text-gray-500`}>
                  <span className="inline-flex items-center">
                    <input
                      value={cellDraft[`${item.id}:tax_percent`] ?? String(item.tax_percent)}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*\.?\d*$/.test(v)) {
                          setCellDraft((prev) => ({ ...prev, [`${item.id}:tax_percent`]: v }));
                        }
                      }}
                      onBlur={() => commitCell(item, 'tax_percent')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { commitCell(item, 'tax_percent'); (e.target as HTMLInputElement).blur(); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-10 px-1 py-0.5 text-center text-xs text-gray-700 bg-white border border-gray-300 rounded-none focus:outline-none focus:bg-gray-50 focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span>%</span>
                  </span>
                </td>
                <td className={`${td} text-center text-gray-500`}>₹{taxAmount.toFixed(2)}</td>
                <td className={`${td} text-center text-blue-600`}>
                  <span className="inline-flex items-center justify-end">
                    <span>-₹</span>
                    <input
                      value={cellDraft[`${item.id}:discount`] ?? (item.discount > 0 ? item.discount.toFixed(2) : '')}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '' || /^\d*\.?\d*$/.test(v)) {
                          setCellDraft((prev) => ({ ...prev, [`${item.id}:discount`]: v }));
                        }
                      }}
                      onBlur={() => commitCell(item, 'discount')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { commitCell(item, 'discount'); (e.target as HTMLInputElement).blur(); }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-14 px-1 py-0.5 text-center text-xs text-blue-600 bg-white border border-gray-300 rounded-none focus:outline-none focus:bg-gray-50 focus:border-green-500 placeholder-gray-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </span>
                </td>
                <td className={`${td} text-center font-bold text-green-600`}>₹{value.toFixed(2)}</td>
              </tr>
            );
          })}
          {Array.from({ length: EMPTY_ROWS }).map((_, e) => {
            const sno = items.length + e + 1;
            const isFirst = e === 0;
            const isActive = activeRow === `empty-${e}`;
            const focusRowInput = (rowIdx: number = e, field: 'code' | 'name' = 'code') => {
              setActiveRow(`empty-${rowIdx}`);
              setEditRow(rowIdx);
              setEditField(field);
              requestAnimationFrame(() => inputRefs.current[`pq-${rowIdx}-${field}`]?.focus());
            };
            return (
              <tr
                key={`empty-${e}`}
                tabIndex={0}
                title="Type a drug code or name in this row to begin billing"
                onClick={(ev) => {
                  if ((ev.target as HTMLElement).tagName === 'INPUT') return;
                  focusRowInput();
                }}
                onKeyDown={(ev) => {
                  const row = ev.currentTarget as HTMLTableRowElement;
                  if ((ev.target as HTMLElement).tagName === 'INPUT') return;
                  if (ev.key === 'ArrowDown') { ev.preventDefault(); (row.nextElementSibling as HTMLElement | null)?.focus(); }
                  else if (ev.key === 'ArrowUp') { ev.preventDefault(); (row.previousElementSibling as HTMLElement | null)?.focus(); }
                  else if (ev.key === 'Enter') { ev.preventDefault(); focusRowInput(); }
                }}
                className={`cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-green-500 ${isActive ? 'bg-blue-50 shadow-[inset_2px_0_0_0_#16a34a]' : isFirst ? 'bg-gray-50' : ''}`}
              >
                <td className={`${td} ${isFirst ? 'text-green-600 font-semibold' : 'text-gray-500'}`}>{sno}</td>
                <td className={td} onClick={(ev) => ev.stopPropagation()}>
                  {renderEntryInput(e, 'code', isFirst ? 'Code…' : '')}
                </td>
                <td className={td} onClick={(ev) => ev.stopPropagation()}>
                  {renderEntryInput(e, 'name', isFirst ? 'Product name…' : '')}
                </td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
                <td className={td}>&nbsp;</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
