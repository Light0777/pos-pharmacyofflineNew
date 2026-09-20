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
}

// Compact dark dropdown matching the invoice grid (native selects draw OS chrome)
function GridPicker({ value, options, onPick }: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onPick: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="max-w-[96px] flex items-center gap-1 bg-[#1a1a1a] border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-200 hover:border-gray-500 focus:outline-none focus:border-green-500"
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
          <div className="absolute left-0 top-full mt-0.5 z-50 w-40 max-h-48 overflow-y-auto bg-[#1a1a1a] border border-gray-700 rounded-md shadow-2xl">
            {options.map((o) => (
              <button
                key={o.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setOpen(false); if (o.value !== value) onPick(o.value); }}
                className={`w-full text-left px-2 py-1.5 text-xs border-b border-gray-800 last:border-b-0 ${o.value === value ? 'bg-[#242424] text-white' : 'text-gray-300 hover:bg-[#242424]'}`}
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
}: CartItemsProps) {
  const { t } = useTranslation();

  useEffect(() => {
    console.log("🛒 CartItems received items update:", items);
    console.log("🛒 Number of items:", items.length);
  }, [items]);

  const [qtyDraft, setQtyDraft] = useState<Record<number, string>>({});
  const [cellDraft, setCellDraft] = useState<Record<string, string>>({});
  const [pq, setPq] = useState('');
  const [pResults, setPResults] = useState<any[]>([]);
  const [pSearching, setPSearching] = useState(false);
  const [editRow, setEditRow] = useState<number | null>(null);
  const [pIdx, setPIdx] = useState(0);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [rowInfo, setRowInfo] = useState<Record<string, { unit?: string; batchNo?: string; expiry?: string; units?: Array<{ unit_uuid: string; unit_name: string; conversion_factor: number; price?: number }>; batches?: Array<{ batch_uuid: string; batch_number: string; expiry_date: string; quantity: number }> }>>({});
  const [activeRow, setActiveRow] = useState<number | string | null>(null);
  const [batchOpenFor, setBatchOpenFor] = useState<number | null>(null);

  // Enrich rows with unit / batch display data using the existing product APIs
  useEffect(() => {
    let cancelled = false;
    const missing = items.filter((item) => {
      const key = `${item.product_uuid}|${item.unit_uuid || ''}|${(item as any).batch_uuid || ''}`;
      return !rowInfo[key];
    });
    missing.forEach(async (item) => {
      const key = `${item.product_uuid}|${item.unit_uuid || ''}|${(item as any).batch_uuid || ''}`;
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
            batchNo: (item as any).batch_number || batch?.batch_number,
            expiry: (item as any).batch_expiry_date || batch?.expiry_date,
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

  // Forward the chosen product to the existing entry workflow (unit/batch modal)
  const requestAddProduct = (product: any) => {
    if (!product?.product_uuid) return;
    setPq('');
    setPResults([]);
    setEditRow(null);
    window.dispatchEvent(new CustomEvent('pos-add-product', { detail: product }));
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
  const th = "font-semibold px-2 py-2 border-b border-gray-700 whitespace-nowrap";
  const td = "px-2 py-1.5 whitespace-nowrap";

  return (
    <div className="overflow-auto h-full">
      <table className="w-full border-collapse text-xs leading-snug min-w-[1320px]">
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#2a2a2a] text-gray-300">
            <th className={`text-left ${th} w-10`}>S.No</th>
            <th className={`text-left ${th} w-24`}>Drug Code</th>
            <th className={`text-left ${th}`}>Drug Name</th>
            <th className={`text-left ${th} w-16`}>UOM</th>
            <th className={`text-center ${th} w-28`}>Qty</th>
            <th className={`text-center ${th} w-14`}>Free</th>
            <th className={`text-left ${th} w-24`}>Batch</th>
            <th className={`text-left ${th} w-20`}>Expiry</th>
            <th className={`text-right ${th} w-20`}>Pur.Price</th>
            <th className={`text-right ${th} w-20`}>Rate</th>
            <th className={`text-center ${th} w-12`}>GST%</th>
            <th className={`text-right ${th} w-16`}>GST Amt</th>
            <th className={`text-right ${th} w-16`}>Disc</th>
            <th className={`text-right ${th} w-20`}>Value</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const subtotal = item.price * item.quantity;
            const taxAmount =
              ((item.price * item.quantity - (item.discount || 0)) *
                item.tax_percent) /
              100;
            const value = subtotal - (item.discount || 0) + taxAmount;
            const info = rowInfo[`${item.product_uuid}|${item.unit_uuid || ''}|${(item as any).batch_uuid || ''}`] || {};
            const isActive = activeRow === item.id;

            return (
              <tr
                key={`${item.product_uuid}_${item.unit_uuid || index}`}
                tabIndex={0}
                onClick={() => setActiveRow(item.id)}
                onKeyDown={(ev) => {
                  const row = ev.currentTarget as HTMLTableRowElement;
                  if ((ev.target as HTMLElement).tagName === 'INPUT') return;
                  if (ev.key === 'ArrowDown') { ev.preventDefault(); (row.nextElementSibling as HTMLElement | null)?.focus(); }
                  else if (ev.key === 'ArrowUp') { ev.preventDefault(); (row.previousElementSibling as HTMLElement | null)?.focus(); }
                  else if (ev.key === 'Enter') { ev.preventDefault(); inputRefs.current[`qty-${item.id}`]?.focus(); }
                }}
                className={`border-b border-gray-800 text-gray-200 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-green-500 ${isActive ? 'bg-[#242424] shadow-[inset_2px_0_0_0_#22c55e]' : 'hover:bg-[#242424]'}`}
              >
                <td className={`${td} text-gray-500`}>{index + 1}</td>
                <td className={`${td} text-gray-400`}>
                  {item.product?.sku || item.product?.barcode || '—'}
                </td>
                <td className={`${td}`}>
                  <span className="font-semibold text-white">
                    {(item.product?.name || t('pos.unknownProduct')).replace('[Custom] ', '')}
                  </span>
                  {item.product?.manufacturer && (
                    <span className="ml-1.5 text-gray-500">{item.product.manufacturer}</span>
                  )}
                  {item.product?.prescription_required ? (
                    <span className="ml-1.5 text-[9px] bg-red-500 text-white px-1 rounded-full font-medium">Rx</span>
                  ) : null}
                  {item.product?.schedule_type && item.product.schedule_type !== 'NONE' && (
                    <span className="ml-1 text-[9px] bg-yellow-600 text-white px-1 rounded-full font-medium">
                      {item.product.schedule_type}
                    </span>
                  )}
                  {onRemove && (
                    <button
                      onClick={() => {
                        onRemove(item);
                      }}
                      className="ml-1.5 text-red-400 hover:text-red-300 align-middle"
                      title="Remove"
                    >
                      <HugeiconsIcon icon={Delete01Icon} className="text-xs" />
                    </button>
                  )}
                </td>
                <td className={`${td} text-gray-300`}>
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
                      className="w-5 h-5 flex items-center justify-center text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      <HugeiconsIcon icon={Remove01Icon} className="text-[10px]" />
                    </button>
                    <input
                      ref={(el) => { inputRefs.current[`qty-${item.id}`] = el; }}
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
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 px-1 py-1 text-center text-xs font-semibold text-white bg-[#212121] border border-gray-700 rounded focus:outline-none focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      onClick={() => onIncrease(item)}
                      className="w-5 h-5 flex items-center justify-center text-gray-300 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                    >
                      <HugeiconsIcon icon={Add01Icon} className="text-[10px]" />
                    </button>
                  </div>
                </td>
                <td className={`${td}`}>
                  <input
                    value={cellDraft[`${item.id}:free_quantity`] ?? String(item.free_quantity ?? 0)}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || /^\d+$/.test(v)) {
                        setCellDraft((prev) => ({ ...prev, [`${item.id}:free_quantity`]: v }));
                      }
                    }}
                    onBlur={() => commitCell(item, 'free_quantity')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { commitCell(item, 'free_quantity'); (e.target as HTMLInputElement).blur(); }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-11 px-1 py-0.5 text-center text-xs text-gray-300 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:bg-[#212121] focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </td>
                <td className={`${td} text-gray-300`}>
                  {info.batches && info.batches.length > 1 && onChangeBatch ? (
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setBatchOpenFor((cur) => (cur === item.id ? null : item.id)); }}
                        className="max-w-[128px] flex items-center gap-1 bg-[#1a1a1a] border border-gray-700 rounded px-1.5 py-0.5 text-xs text-gray-200 hover:border-gray-500 focus:outline-none focus:border-green-500"
                        title="Switch batch"
                      >
                        <span className="truncate">{info.batchNo || 'Select'}</span>
                        <span className="text-gray-500 text-[9px]">▾</span>
                      </button>
                      {batchOpenFor === item.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => { e.stopPropagation(); setBatchOpenFor(null); }}
                          />
                          <div className="absolute left-0 top-full mt-0.5 z-50 w-56 max-h-48 overflow-y-auto bg-[#1a1a1a] border border-gray-700 rounded-md shadow-2xl">
                            {info.batches.map((b) => {
                              const selected = b.batch_uuid === (item as any).batch_uuid;
                              return (
                                <button
                                  key={b.batch_uuid}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => { setBatchOpenFor(null); if (!selected) onChangeBatch(item, b.batch_uuid); }}
                                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left text-xs border-b border-gray-800 last:border-b-0 ${selected ? 'bg-[#242424] text-white' : 'text-gray-300 hover:bg-[#242424]'}`}
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
                  ) : (info.batchNo || '—')}
                </td>
                <td className={`${td} text-gray-400`}>{fmtExp(info.expiry)}</td>
                <td className={`${td} text-right text-gray-400`}>
                  {item.product?.purchase_price ? `₹${Number(item.product.purchase_price).toFixed(2)}` : '—'}
                </td>
                <td className={`${td} text-right text-gray-200`}>
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
                    className="w-16 px-1 py-0.5 text-right text-xs text-gray-200 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:bg-[#212121] focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </td>
                <td className={`${td} text-center text-gray-400`}>
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
                      className="w-10 px-1 py-0.5 text-center text-xs text-gray-300 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:bg-[#212121] focus:border-green-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span>%</span>
                  </span>
                </td>
                <td className={`${td} text-right text-gray-400`}>₹{taxAmount.toFixed(2)}</td>
                <td className={`${td} text-right text-blue-400`}>
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
                      className="w-14 px-1 py-0.5 text-right text-xs text-blue-400 bg-[#1a1a1a] border border-gray-700 rounded focus:outline-none focus:bg-[#212121] focus:border-green-500 placeholder-gray-600 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </span>
                </td>
                <td className={`${td} text-right font-bold text-green-400`}>₹{value.toFixed(2)}</td>
              </tr>
            );
          })}
          {Array.from({ length: EMPTY_ROWS }).map((_, e) => {
            const sno = items.length + e + 1;
            const isFirst = e === 0;
            const isActive = activeRow === `empty-${e}`;
            const focusRowInput = () => {
              setActiveRow(`empty-${e}`);
              setEditRow(e);
              requestAnimationFrame(() => inputRefs.current[`pq-${e}`]?.focus());
            };
            return (
              <tr
                key={`empty-${e}`}
                tabIndex={0}
                title="Type a product in this row to begin billing"
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
                className={`border-b border-gray-800 cursor-pointer focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-green-500 ${isActive ? 'bg-[#242424] shadow-[inset_2px_0_0_0_#22c55e]' : isFirst ? 'bg-white/[0.02]' : ''}`}
              >
                <td className={`${td} ${isFirst ? 'text-green-500 font-semibold' : 'text-gray-600'}`}>{sno}</td>
                <td className={td}>&nbsp;</td>
                <td className={td} onClick={(ev) => ev.stopPropagation()}>
                  <div className="relative min-w-[160px]">
                    <input
                      ref={(el) => { inputRefs.current[`pq-${e}`] = el; }}
                      value={editRow === e ? pq : ''}
                      placeholder={isFirst ? 'Type product name / code…' : ''}
                      onChange={(ev) => { setEditRow(e); setActiveRow(`empty-${e}`); setPq(ev.target.value); }}
                      onFocus={() => { setEditRow(e); setActiveRow(`empty-${e}`); }}
                      onBlur={() => setTimeout(() => { setEditRow((cur) => (cur === e ? null : cur)); }, 150)}
                      onKeyDown={(ev) => {
                        ev.stopPropagation();
                        if (ev.key === 'ArrowDown' && pResults.length > 0) { ev.preventDefault(); setPIdx((i) => Math.min(i + 1, pResults.length - 1)); }
                        else if (ev.key === 'ArrowUp' && pResults.length > 0) { ev.preventDefault(); setPIdx((i) => Math.max(i - 1, 0)); }
                        else if (ev.key === 'Enter' && editRow === e && pResults.length > 0) { ev.preventDefault(); requestAddProduct(pResults[Math.min(pIdx, pResults.length - 1)]); }
                        else if (ev.key === 'Escape') { setPq(''); setEditRow(null); (ev.target as HTMLInputElement).blur(); }
                      }}
                      className="w-full bg-transparent text-white placeholder-gray-600 px-1 py-0.5 rounded text-xs focus:outline-none focus:bg-[#212121] focus:ring-1 focus:ring-green-500"
                    />
                    {editRow === e && pq.trim().length >= 2 && (
                      <div className="absolute left-0 top-full mt-0.5 z-50 w-72 max-h-56 overflow-y-auto bg-[#1a1a1a] border border-gray-700 rounded-md shadow-2xl">
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
                              className={`px-2 py-1.5 cursor-pointer border-b border-gray-800 ${i === pIdx ? 'bg-[#242424]' : ''}`}
                            >
                              <div className="font-semibold text-white text-xs truncate">{p.name}</div>
                              <div className="text-gray-500 text-[10px] truncate">
                                {[p.sku, p.barcode, p.manufacturer].filter(Boolean).join(' • ')}{p.price != null ? ` • ₹${p.price}` : ''}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
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
                <td className={td}>&nbsp;</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
