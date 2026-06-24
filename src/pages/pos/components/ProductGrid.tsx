import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Product } from "../../../renderer/types/product";
import { getProductBatches, getProductUnits, getAvailableBatches } from "../../../renderer/services/productApi";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  Time01Icon,
  Medicine01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ProductGridProps {
  products: Product[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onAddItem: (product: Product, unitUuid: string, quantity: number, unitName: string, batchUuid?: string) => void;
}

interface BatchInfo {
  batch_uuid: string;
  batch_number: string;
  expiry_date: string;
  selling_price: number;
  quantity: number;
  sold_quantity: number;
  available: number;
}

interface ProductUnit {
  unit_uuid: string;
  unit_name: string;
  conversion_factor: number;
  price: number | null;
  is_base_unit: boolean;
}

import { searchProducts } from "../../../renderer/services/productApi";

// Calculate days until expiry
const getDaysUntilExpiry = (expiryDate: string): number => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Unit Selection Modal Component
function UnitSelectionModal({ 
  isOpen, 
  product, 
  units, 
  batches,
  onClose, 
  onConfirm 
}: { 
  isOpen: boolean; 
  product: Product | null; 
  units: ProductUnit[];
  batches: BatchInfo[];
  onClose: () => void;
  onConfirm: (unitUuid: string, quantity: number, unitName: string, price: number, batchUuid?: string) => void;
}) {
  const [selectedUnitUuid, setSelectedUnitUuid] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUnit, setSelectedUnit] = useState<ProductUnit | null>(null);
  const [selectedBatchUuid, setSelectedBatchUuid] = useState<string>("");

  const availableUnits = units.filter(u => !(u.unit_name === "Box" && product && !(Number((product as any).boxes) > 0)));

  useEffect(() => {
    if (availableUnits.length > 0 && (!selectedUnitUuid || !availableUnits.find(u => u.unit_uuid === selectedUnitUuid))) {
      const defaultUnit = availableUnits.find(u => u.is_base_unit) || availableUnits[0];
      setSelectedUnitUuid(defaultUnit.unit_uuid);
      setSelectedUnit(defaultUnit);
    }
  }, [availableUnits, selectedUnitUuid]);

  useEffect(() => {
    const unit = availableUnits.find(u => u.unit_uuid === selectedUnitUuid);
    setSelectedUnit(unit || null);
  }, [selectedUnitUuid, availableUnits]);

  useEffect(() => {
    if (selectedUnit) {
      const maxQty = Math.floor(batchTabletQty / (selectedUnit.conversion_factor || 1));
      if (quantity > maxQty) setQuantity(Math.max(1, maxQty));
    }
  }, [selectedUnit, selectedBatchUuid]);

  useEffect(() => {
    if (batches.length > 0) {
      setSelectedBatchUuid(batches[0].batch_uuid);
    } else {
      setSelectedBatchUuid("");
    }
  }, [batches]);

  const getUnitPrice = (unit: ProductUnit | null) => {
    if (!unit) return product?.price || 0;
    return unit.price || product?.price || 0;
  };
  const totalPrice = selectedUnit ? (getUnitPrice(selectedUnit) * quantity).toFixed(2) : "0.00";

  const selectedBatch = batches.find(b => b.batch_uuid === (selectedBatchUuid || batches[0]?.batch_uuid));
  const batchTabletQty = selectedBatch?.quantity ?? 0;
  const availableForUnit = selectedUnit
    ? Math.floor(batchTabletQty / (selectedUnit.conversion_factor || 1))
    : 0;

  const getDaysUntilExpiry = (expiryDate: string): number => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-white border border-gray-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900 text-lg">Add to Cart</DialogTitle>
          {product && (
            <p className="text-sm text-gray-500 mt-1">{product.name}</p>
          )}
        </DialogHeader>

        <div className="space-y-5">
          {/* Unit Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Select Unit Type
            </label>
            <Select value={selectedUnitUuid} onValueChange={setSelectedUnitUuid}>
              <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                <SelectValue placeholder="Select unit type" />
              </SelectTrigger>
              <SelectContent className="bg-white border-gray-300 text-gray-900">
                {availableUnits.map((unit) => (
                  <SelectItem key={unit.unit_uuid} value={unit.unit_uuid}>
                    {unit.unit_name} {unit.is_base_unit && "(Base)"}
                    {unit.price && ` - ₹${unit.price}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Batch Selection */}
          {batches.length > 1 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Batch
              </label>
              <div className="max-h-52 overflow-y-auto space-y-2 border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                {batches.map((batch) => {
                  const daysLeft = getDaysUntilExpiry(batch.expiry_date);
                  const isExpiringSoon = daysLeft <= 90 && daysLeft > 0;
                  const isExpired = daysLeft <= 0;
                  const barWidth = daysLeft > 365 ? 100 : Math.max(5, Math.round((daysLeft / 365) * 100));
                  const barColor = isExpired ? 'bg-red-500' : isExpiringSoon ? 'bg-amber-400' : 'bg-green-500';
                  const qty = (batch as any).quantity ?? 0;
                  return (
                    <div
                      key={batch.batch_uuid}
                      onClick={() => setSelectedBatchUuid(batch.batch_uuid)}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                        selectedBatchUuid === batch.batch_uuid
                          ? 'bg-white ring-2 ring-green-500 shadow-sm'
                          : 'bg-white hover:ring-1 hover:ring-gray-300'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm text-gray-900">{batch.batch_number}</span>
                          {!isExpired && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              isExpiringSoon
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {daysLeft} days left
                            </span>
                          )}
                          {isExpired && (
                            <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span>Qty: <span className="font-medium text-gray-700">{qty}</span></span>
                          <span className="text-gray-300">|</span>
                          <span>Exp: {new Date(batch.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {/* Expiry progress bar */}
                        {!isExpired && (
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${barWidth}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-600">
                Quantity
              </label>
              {selectedUnit && (
                <span className="text-sm text-gray-500">
                  Available: <span className="font-semibold text-gray-800">{availableForUnit}</span> {selectedUnit.unit_name.toLowerCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="border-gray-300 text-gray-700"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="1"
                max={availableForUnit || 999999}
                value={quantity || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setQuantity(0);
                    return;
                  }
                  const parsed = parseInt(val);
                  if (!isNaN(parsed) && parsed >= 1) {
                    setQuantity(Math.min(parsed, availableForUnit || 999999));
                  }
                }}
                onBlur={() => { if (quantity < 1) setQuantity(1); }}
                className="w-20 text-center bg-white border-gray-300 text-gray-900 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={quantity >= (availableForUnit || 0)}
                onClick={() => setQuantity(Math.min(quantity + 1, availableForUnit || 999999))}
                className="border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Price Preview */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Unit Price:</span>
              <span className="font-semibold text-gray-900">
                ₹{getUnitPrice(selectedUnit).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="text-gray-500">Total Price:</span>
              <span className="text-xl font-bold text-green-600">
                ₹{totalPrice}
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (selectedUnit) {
                  onConfirm(
                    selectedUnitUuid,
                    quantity,
                    selectedUnit.unit_name,
                    getUnitPrice(selectedUnit),
                    selectedBatchUuid || undefined
                  );
                }
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <ShoppingCart className="h-4 w-4 mr-1" />
              Add to Cart
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProductGrid({ products, loading, page, totalPages, onPageChange, onAddItem }: ProductGridProps) {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState("");
  const [recentUUIDs, setRecentUUIDs] = useState<string[]>([]);
  const [batchInfo, setBatchInfo] = useState<Record<string, BatchInfo[]>>({});
  const [loadingBatch, setLoadingBatch] = useState<Record<string, boolean>>({});
  
  // Unit selection modal state
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [productBatches, setProductBatches] = useState<BatchInfo[]>([]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const clickSeqRef = useRef(0);

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // Server-side search state
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Virtual scrolling state
  const gridRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [gridDimensions, setGridDimensions] = useState({ width: 0, height: 0 });

  // Responsive columns: 2 below 1800px, 3 at 1800px+
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1800);

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load batch info for products
  const loadBatchInfoForProduct = async (productUuid: string) => {
    if (batchInfo[productUuid] || loadingBatch[productUuid]) return;
    
    setLoadingBatch(prev => ({ ...prev, [productUuid]: true }));
    try {
      const batches = await getProductBatches(productUuid);
      const availableBatches = batches
        .filter((b: any) => {
          return (b.quantity || 0) > 0 && new Date(b.expiry_date) > new Date();
        })
        .map((b: any) => ({
          ...b,
          available: b.quantity || 0
        }))
        .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
      
      setBatchInfo(prev => ({ ...prev, [productUuid]: availableBatches }));
    } catch (err) {
      console.error("Failed to load batches:", err);
    } finally {
      setLoadingBatch(prev => ({ ...prev, [productUuid]: false }));
    }
  };

  // Load units for a product
  const loadProductUnits = async (productUuid: string): Promise<ProductUnit[]> => {
    try {
      const units = await getProductUnits(productUuid);
      return units.map((u: any) => ({
        unit_uuid: u.unit_uuid,
        unit_name: u.unit_name,
        conversion_factor: u.conversion_factor,
        price: u.price,
        is_base_unit: u.is_base_unit === 1
      }));
    } catch (err) {
      console.error("Failed to load units:", err);
      return [];
    }
  };

  // Handle product click - show unit selection modal
  const handleProductClick = async (product: Product) => {
    const seq = ++clickSeqRef.current;
    const units = await loadProductUnits(product.product_uuid);

    if (seq !== clickSeqRef.current) return;
    
    if (units.length === 0) {
      showToast(`No pack sizes defined for "${product.name}". Please add pack sizes first.`);
      return;
    }
    
    const batches = await getAvailableBatches(product.product_uuid);

    if (seq !== clickSeqRef.current) return;
    
    setSelectedProduct(product);
    setProductUnits(units);
    setProductBatches(batches);
    setShowUnitModal(true);
  };

  // Handle unit selection confirmation
  const handleUnitConfirm = (unitUuid: string, quantity: number, unitName: string, price: number, batchUuid?: string) => {
    if (selectedProduct) {
      onAddItem(selectedProduct, unitUuid, quantity, unitName, batchUuid);
      setRecentUUIDs(prev => {
        const filtered = prev.filter(id => id !== selectedProduct.product_uuid);
        return [selectedProduct.product_uuid, ...filtered].slice(0, 20);
      });
    }
    setShowUnitModal(false);
    setSelectedProduct(null);
    setProductUnits([]);
    setProductBatches([]);
  };

  // Load batch info for visible products
  useEffect(() => {
    if (products.length > 0) {
      const productsToLoad = products.slice(0, 20);
      productsToLoad.forEach(product => {
        const stock = product.stock ?? 0;
        if (stock > 0) {
          loadBatchInfoForProduct(product.product_uuid);
        }
      });
    }
  }, [products]);

  // Server-side search when user types (debounced)
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchProducts(searchTerm.trim());
        if (!cancelled) setSearchResults(results);
      } catch (err) {
        if (!cancelled) {
          console.error("Search failed:", err);
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  // Use server results when available, otherwise filter paginated products
  const filteredProducts = useMemo(() => {
    const source = searchResults ?? products;
    const searchLower = searchTerm.toLowerCase();
    return source.filter((product) => (
      product.name.toLowerCase().includes(searchLower) ||
      (product.sku && product.sku.toLowerCase().includes(searchLower)) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchLower))
    ));
  }, [products, searchTerm, searchResults]);

  const sortedProducts = useMemo(() => {
    if (searchResults) return filteredProducts;
    return searchTerm
      ? filteredProducts
      : [
          ...filteredProducts.filter(p => recentUUIDs.includes(p.product_uuid))
            .sort((a, b) => recentUUIDs.indexOf(a.product_uuid) - recentUUIDs.indexOf(b.product_uuid)),
          ...filteredProducts.filter(p => !recentUUIDs.includes(p.product_uuid))
        ];
  }, [searchTerm, filteredProducts, recentUUIDs, searchResults]);

  // Virtual scrolling handlers and calculations
  const handleScroll = useCallback(() => {
    if (gridRef.current) {
      setScrollTop(gridRef.current.scrollTop);
    }
  }, []);

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setGridDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    setGridDimensions({
      width: el.clientWidth,
      height: el.clientHeight,
    });
    return () => observer.disconnect();
  }, []);

  const PADDING = 12;
  const GAP = 8;
  const BUFFER_ROWS = 3;

  const containerWidth = gridDimensions.width;
  const containerHeight = gridDimensions.height;
  const COLS = windowWidth >= 1800 ? 3 : 2;
  const colWidth = containerWidth > 0
    ? (containerWidth - PADDING * 2 - GAP * (COLS - 1)) / COLS
    : 0;
  const cardHeight = colWidth > 0 ? Math.max(colWidth * 0.45, 100) : 0;
  const rowHeight = cardHeight > 0 ? cardHeight + GAP : 0;
  const totalRows = colWidth > 0 ? Math.ceil(sortedProducts.length / COLS) : 0;
  const totalHeight = totalRows * rowHeight;
  const startRow = colWidth > 0
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS)
    : 0;
  const endRow = colWidth > 0
    ? Math.min(totalRows, Math.ceil((scrollTop + containerHeight) / rowHeight) + BUFFER_ROWS)
    : 0;
  const startIndex = startRow * COLS;
  const endIndex = Math.min(sortedProducts.length, endRow * COLS);
  const visibleProducts = sortedProducts.slice(startIndex, endIndex);

  // Reset scroll when search results change
  useEffect(() => {
    setScrollTop(0);
    if (gridRef.current) {
      gridRef.current.scrollTop = 0;
    }
  }, [sortedProducts]);

  // Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (loading && products.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3">
          <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
        </div>
        <div className="flex-1 overflow-y-auto p-3 gap-2" style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {[...Array(COLS * 3)].map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse bg-gray-100" style={{ aspectRatio: '2.22 / 1' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Custom Toast Notification */}
      <div
        className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          toast.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"
        }`}
      >
        <div className="bg-red-600 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium">
          <HugeiconsIcon icon={AlertCircleIcon} className="text-lg shrink-0"  />
          <span>{toast.message}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 sticky top-0 z-10 bg-[#141414]">
        <div className="relative">
          <div className="absolute left-4 inset-y-0 flex items-center text-gray-400 pointer-events-none">
            <HugeiconsIcon icon={Search01Icon} className="text-lg"  />
          </div>
          <input
            ref={searchRef}
            type="text"
            placeholder={t('pos.searchProducts')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-20 py-2.5 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all font-inter bg-white"
            autoComplete="off"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
          {!searchTerm && (
            <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold bg-gray-100 rounded-full pointer-events-none flex items-center gap-0.5">
              <span className="text-green-600">Ctrl</span>
              <span className="text-gray-400">+K</span>
            </kbd>
          )}
        </div>
        {searchTerm && (
          <div className="text-xs text-gray-500 mt-1.5 ml-1">
            {t('pos.foundProducts', { count: filteredProducts.length })}
          </div>
        )}
      </div>

      {/* Product Grid - Virtual Scrolling */}
      <div ref={gridRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide relative" onScroll={handleScroll}>
        {loading && products.length > 0 && (
          <div className="absolute inset-0 bg-black/50 z-20 flex items-start justify-center pt-12 pointer-events-none">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        )}
        {sortedProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <HugeiconsIcon icon={Search01Icon} className="text-3xl mb-2 text-gray-400" />
            <p className="text-sm">{t('pos.noProductsFound')}</p>
            <p className="text-xs mt-1">{t('pos.tryDifferentSearch')}</p>
          </div>
        ) : colWidth > 0 ? (
          <div style={{ height: Math.max(totalHeight + PADDING * 2, containerHeight), position: 'relative', paddingBottom: 48 }}>
            {visibleProducts.map((p, i) => {
              const actualIndex = startIndex + i;
              const row = Math.floor(actualIndex / COLS);
              const col = actualIndex % COLS;
              const stock = p.stock ?? 0;
              const productBatches = batchInfo[p.product_uuid] || [];
              const hasBatches = productBatches.length > 0;
              const nearestExpiry = hasBatches ? productBatches[0] : null;
              const daysUntilExpiry = nearestExpiry ? getDaysUntilExpiry(nearestExpiry.expiry_date) : null;
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 90 && daysUntilExpiry > 0;
              const batchCount = productBatches.length;
              const hasImage = !!(p as any).image;

              return (
                <div
                  key={p.product_uuid}
                  className="border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-800 rounded-2xl cursor-pointer flex flex-row overflow-hidden transition-all duration-200 font-inter hover:scale-[1.02] hover:shadow-lg"
                  style={{
                    position: 'absolute',
                    top: row * rowHeight + PADDING,
                    left: col * (colWidth + GAP) + PADDING,
                    width: colWidth,
                    height: cardHeight,
                  }}
                  onClick={() => handleProductClick(p)}
                >
                  {/* Left: Image or Placeholder - square, sized relative to card */}
                  <div className="flex-shrink-0 self-center overflow-hidden rounded-xl aspect-square mx-[1.3%]" style={{ width: '40%' }}>
                    {hasImage ? (
                      <img
                        src={(p as any).image}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: '#83df1a' }}>
                          <HugeiconsIcon icon={Medicine01Icon} className="text-xl text-white"  />
                      </div>
                    )}
                  </div>

                  {/* Right: Product Details */}
                  <div className="flex-1 min-w-0 px-2.5 py-1.5 flex flex-col justify-start gap-[1px] text-left">
                    {/* Product Name */}
                    <div className="font-semibold text-xs truncate leading-tight text-gray-900">
                      {p.name}
                    </div>

                    {/* Manufacturer */}
                    {p.manufacturer && (
                      <div className="text-[10px] truncate leading-tight text-gray-500">
                        {p.manufacturer}
                      </div>
                    )}

                    {/* Batch & Expiry Info */}
                    <div className="flex flex-wrap gap-x-2">
                      {batchCount > 0 && (
                        <div className="text-[10px] flex items-center gap-0.5 text-gray-500">
                          <span>{batchCount} batch{batchCount > 1 ? 'es' : ''}</span>
                        </div>
                      )}
                      {stock > 0 && (
                        <div className={`text-[10px] flex items-center gap-0.5 ${isExpiringSoon ? 'text-orange-600' : 'text-gray-500'}`}>
                          {isExpiringSoon ? (
                            <>
                              <HugeiconsIcon icon={Time01Icon} className="text-[8px]"  />
                              <span>{daysUntilExpiry}d expiry</span>
                            </>
                          ) : nearestExpiry ? (
                            <span>Exp: {new Date(nearestExpiry.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Price and Rx Badge */}
                    <div className="flex items-center gap-1.5">
                      <div className="text-xs font-bold text-gray-900">
                        ₹{p.price}
                      </div>
                      {p.prescription_required === 1 && (
                        <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-medium leading-none">
                          Rx
                        </span>
                      )}
                    </div>

                    {/* Stock Badge */}
                    <div>
                      {stock === 0 ? (
                        <span className="text-[9px] bg-gray-700 text-white px-1.5 py-0.5 rounded-full font-medium inline-block leading-none">
                          Out of Stock
                        </span>
                      ) : stock < 10 ? (
                        <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded-full font-medium inline-block leading-none">
                          Only {stock} left
                        </span>
                      ) : (
                        <span className="text-[9px] bg-green-700 text-white px-1.5 py-0.5 rounded-full font-medium inline-block leading-none">
                          {stock} remaining
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      {!searchResults && totalPages > 1 && (
        <div className="sticky bottom-0 flex justify-center py-3 pointer-events-none">
          <div className="flex items-center pointer-events-auto gap-x-1.5">
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 flex items-center shadow-sm">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="px-2 py-1 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-900"
              >
                ‹ Prev
              </button>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 flex items-center shadow-sm">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - page) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0) {
                      const prev = arr[idx - 1];
                      if (p - prev > 1) acc.push('ellipsis');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`e${idx}`} className="px-1.5 text-gray-400 text-sm">...</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => onPageChange(item)}
                        className={`text-sm font-medium transition-colors ${
                          item === page
                            ? 'bg-green-600 text-white rounded px-2.5 py-1'
                            : 'px-1.5 text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 flex items-center shadow-sm">
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="px-2 py-1 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 hover:text-gray-900"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* Unit Selection Modal */}
      <UnitSelectionModal
        isOpen={showUnitModal}
        product={selectedProduct}
        units={productUnits}
        batches={productBatches}
        onClose={() => {
          setShowUnitModal(false);
          setSelectedProduct(null);
          setProductUnits([]);
          setProductBatches([]);
        }}
        onConfirm={handleUnitConfirm}
      />
    </div>
  );
}