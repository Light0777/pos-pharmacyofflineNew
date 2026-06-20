import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  PrinterIcon,
  Add01Icon,
  Remove01Icon,
} from "@hugeicons/core-free-icons";

interface Product {
  product_uuid: string;
  name: string;
  price: number;
  barcode?: string;
  gst_percent?: number;
  hsn_code?: string;
}

interface LabelItem {
  product: Product;
  quantity: number;
}

export default function PrintLabelsModal({ products, onClose }: {
  products: Product[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [step, setStep] = useState<'select' | 'preview'>('select');
  const printRef = useRef<HTMLDivElement>(null);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.barcode && p.barcode.includes(search))
  );

  const addProduct = (product: Product) => {
    if (labelItems.find(i => i.product.product_uuid === product.product_uuid)) return;
    setLabelItems(prev => [...prev, { product, quantity: 10 }]);
  };

  const removeProduct = (uuid: string) => {
    setLabelItems(prev => prev.filter(i => i.product.product_uuid !== uuid));
  };

  const updateQty = (uuid: string, qty: number) => {
    setLabelItems(prev => prev.map(i =>
      i.product.product_uuid === uuid ? { ...i, quantity: Math.max(1, qty) } : i
    ));
  };

  // Expand label items into individual labels
  const allLabels = labelItems.flatMap(item =>
    Array(item.quantity).fill(item.product)
  );

  const handlePrint = () => {
    window.print();
  };

  // Render barcodes after preview step
  useEffect(() => {
    if (step === 'preview') {
      setTimeout(() => {
        allLabels.forEach((product, index) => {
          if (!product.barcode) return;
          const canvas = document.getElementById(`barcode-${index}`) as HTMLCanvasElement;
          if (!canvas) return;
          try {
            // @ts-ignore
            JsBarcode(canvas, product.barcode, {
              format: "CODE128",
              width: 1.5,
              height: 30,
              displayValue: true,
              fontSize: 8,
              margin: 2,
            });
          } catch (e) {
            console.error('Barcode error:', e);
          }
        });
      }, 100);
    }
  }, [step, labelItems]);

  return (
    <>
      {/* JsBarcode CDN */}
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js" />

      {createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-4xl max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white rounded-t-2xl flex justify-between items-center flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold">Print Barcode Labels</h2>
              <p className="text-gray-300 text-sm mt-0.5">
                {step === 'select'
                  ? `${labelItems.length} products selected · ${allLabels.length} total labels`
                  : `Ready to print ${allLabels.length} labels`}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
              <HugeiconsIcon icon={Cancel01Icon} className="text-2xl"  />
            </button>
          </div>

          {step === 'select' ? (
            <div className="flex gap-4 p-6 flex-1 overflow-hidden">

              {/* Left: Product search */}
              <div className="w-1/2 flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div className="overflow-y-auto flex-1 space-y-1 max-h-96">
                  {filtered.map(p => {
                    const added = labelItems.find(i => i.product.product_uuid === p.product_uuid);
                    return (
                      <div key={p.product_uuid}
                        className={`flex justify-between items-center p-3 rounded-xl border cursor-pointer transition-all ${added ? 'bg-purple-50 border-purple-200' : 'hover:bg-gray-50 border-gray-100'}`}
                        onClick={() => added ? removeProduct(p.product_uuid) : addProduct(p)}
                      >
                        <div>
                          <p className="font-medium text-gray-800 text-sm">{p.name}</p>
                          <p className="text-xs text-gray-400">₹{p.price} {p.barcode ? `· ${p.barcode}` : '· No barcode'}</p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full ${added ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                          {added ? '✓ Added' : '+ Add'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Selected products with qty */}
              <div className="w-1/2 flex flex-col gap-3">
                <p className="font-semibold text-gray-700">Selected Products</p>
                {labelItems.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                    Click products to add them
                  </div>
                ) : (
                  <div className="overflow-y-auto flex-1 space-y-2 max-h-96">
                    {labelItems.map(item => (
                      <div key={item.product.product_uuid}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm truncate">{item.product.name}</p>
                          <p className="text-xs text-gray-400">₹{item.product.price}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg">
                          <button
                            onClick={() => updateQty(item.product.product_uuid, item.quantity - 1)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-l-lg"
                          >
                            <HugeiconsIcon icon={Remove01Icon} className="text-sm"  />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateQty(item.product.product_uuid, parseInt(e.target.value) || 1)}
                            className="w-10 text-center text-sm font-semibold focus:outline-none"
                          />
                          <button
                            onClick={() => updateQty(item.product.product_uuid, item.quantity + 1)}
                            className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded-r-lg"
                          >
                            <HugeiconsIcon icon={Add01Icon} className="text-sm"  />
                          </button>
                        </div>
                        <button
                          onClick={() => removeProduct(item.product.product_uuid)}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => setStep('preview')}
                  disabled={labelItems.length === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold disabled:opacity-40"
                >
                  Preview {allLabels.length} Labels →
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex justify-between items-center px-6 py-3 border-b flex-shrink-0">
                <button onClick={() => setStep('select')} className="text-gray-500 hover:text-gray-700 text-sm">
                  ← Back
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-xl font-semibold"
                >
                  <HugeiconsIcon icon={PrinterIcon}  />
                  Print Labels
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                <div ref={printRef} id="labels-print-area">
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '4px',
                    width: '100%',
                  }}>
                    {allLabels.map((product, index) => (
                      <div key={index} style={{
                        border: '1px dashed #ccc',
                        borderRadius: '4px',
                        padding: '6px',
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontSize: '10px',
                        backgroundColor: '#fff',
                        pageBreakInside: 'avoid',
                      }}>
                        {/* Product Name */}
                        <div style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                          {product.name}
                        </div>

                        {/* Barcode */}
                        {product.barcode ? (
                          <canvas id={`barcode-${index}`} style={{ maxWidth: '100%' }} />
                        ) : (
                          <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '9px' }}>
                            No Barcode
                          </div>
                        )}

                        {/* Price */}
                        <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>
                          MRP: ₹{product.price}
                        </div>

                        {/* GST & HSN */}
                        <div style={{ fontSize: '9px', color: '#555', marginTop: '1px' }}>
                          {product.gst_percent > 0 && <span>GST: {product.gst_percent}% </span>}
                          {product.hsn_code && <span>HSN: {product.hsn_code}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>,
      document.body
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #labels-print-area, #labels-print-area * { visibility: visible; }
          #labels-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>
    </>
  );
}