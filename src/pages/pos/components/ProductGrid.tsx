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
  is_expired?: boolean;
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
    const firstSellable = batches.find(b => !b.is_expired);
    if (firstSellable) {
      setSelectedBatchUuid(firstSellable.batch_uuid);
    } else {
      setSelectedBatchUuid("");
    }
  }, [batches]);

  const getUnitPrice = (unit: ProductUnit | null) => {
    if (!unit) return product?.price || 0;
    return unit.price || product?.price || 0;
  };
  const totalPrice = selectedUnit ? (getUnitPrice(selectedUnit) * quantity).toFixed(2) : "0.00";

  const selectedBatch = batches.find(b => b.batch_uuid === (selectedBatchUuid || batches.find(b => !b.is_expired)?.batch_uuid));
  const batchTabletQty = selectedBatch && !selectedBatch.is_expired ? selectedBatch.quantity : 0;
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
          {batches.length > 0 && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {batches.length > 1 ? 'Select Batch' : 'Batch'}
              </label>
              <div className="max-h-52 overflow-y-auto space-y-2 border border-gray-200 rounded-xl p-2.5 bg-gray-50/50">
                {batches.map((batch) => {
                  const daysLeft = getDaysUntilExpiry(batch.expiry_date);
                  const isExpiringSoon = daysLeft <= 90 && daysLeft > 0;
                  const isExpired = batch.is_expired || daysLeft <= 0;
                  const barWidth = daysLeft > 365 ? 100 : Math.max(5, Math.round((daysLeft / 365) * 100));
                  const barColor = isExpired ? 'bg-red-500' : isExpiringSoon ? 'bg-amber-400' : 'bg-green-500';
                  const qty = batch.quantity ?? 0;
                  return (
                    <div
                      key={batch.batch_uuid}
                      onClick={() => { if (!isExpired) setSelectedBatchUuid(batch.batch_uuid); }}
                      className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                        isExpired
                          ? 'bg-gray-100 opacity-60 cursor-not-allowed'
                          : selectedBatchUuid === batch.batch_uuid
                            ? 'bg-white ring-2 ring-green-500 shadow-sm cursor-pointer'
                            : 'bg-white hover:ring-1 hover:ring-gray-300 cursor-pointer'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-semibold text-sm ${isExpired ? 'text-gray-500' : 'text-gray-900'}`}>{batch.batch_number}</span>
                          {!isExpired && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-none ${
                              isExpiringSoon
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {daysLeft} days left
                            </span>
                          )}
                          {isExpired && (
                            <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-none">
                              Expired
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                          <span>Qty: <span className={`font-medium ${isExpired ? 'text-gray-400' : 'text-gray-700'}`}>{qty}</span></span>
                          <span className="text-gray-300">|</span>
                          <span>Exp: {new Date(batch.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        {/* Expiry progress bar */}
                        {!isExpired && (
                          <div className="mt-2 h-1.5 bg-gray-100 rounded-none overflow-hidden">
                            <div className={`h-full rounded-none ${barColor} transition-all`} style={{ width: `${barWidth}%` }} />
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
                if (selectedUnit && selectedBatch && !selectedBatch.is_expired) {
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
  // Window listeners below (pos-add-product) are registered once — they must
  // always call the LATEST onAddItem, otherwise adds keep posting to the
  // cart that was active on first render (stale cartUUID after new bills).
  const onAddItemRef = useRef(onAddItem);
  onAddItemRef.current = onAddItem;
  const [searchTerm, setSearchTerm] = useState("");
  const [recentUUIDs, setRecentUUIDs] = useState<string[]>([]);
  const [batchInfo, setBatchInfo] = useState<Record<string, BatchInfo[]>>({});
  const [loadingBatch, setLoadingBatch] = useState<Record<string, boolean>>({});
  const [hasExpiredStock, setHasExpiredStock] = useState<Record<string, boolean>>({});
  const [expiredQuantities, setExpiredQuantities] = useState<Record<string, number>>({});
  const [totalBatchCounts, setTotalBatchCounts] = useState<Record<string, number>>({});
  const [cacheVersion, setCacheVersion] = useState(0);
  
  // Unit selection modal state
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productUnits, setProductUnits] = useState<ProductUnit[]>([]);
  const [productBatches, setProductBatches] = useState<BatchInfo[]>([]);

  // Toast notification state (error red, success green)
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const [toastTone, setToastTone] = useState<'error' | 'success'>('error');
  const clickSeqRef = useRef(0);

  const showToast = (message: string, tone: 'error' | 'success' = 'error') => {
    setToastTone(tone);
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
  };

  // Server-side search state
  const [searchResults, setSearchResults] = useState<Product[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Search dropdown state (entry mode: selection adds a row to the invoice table)
  const [dropOpen, setDropOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const dropListRef = useRef<HTMLDivElement>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  // Invalidate batch cache and trigger refresh
  const invalidateBatchCache = useCallback(() => {
    setBatchInfo({});
    setHasExpiredStock({});
    setExpiredQuantities({});
    setTotalBatchCounts({});
    setCacheVersion(v => v + 1);
  }, []);

  // Listen for stock-updated events and visibility changes to invalidate cache
  useEffect(() => {
    const handler = () => invalidateBatchCache();
    window.addEventListener('stock-updated', handler);
    const visHandler = () => {
      if (document.visibilityState === 'visible') invalidateBatchCache();
    };
    document.addEventListener('visibilitychange', visHandler);
    return () => {
      window.removeEventListener('stock-updated', handler);
      document.removeEventListener('visibilitychange', visHandler);
    };
  }, [invalidateBatchCache]);

  // Load batch info for products
  const loadBatchInfoForProduct = async (productUuid: string) => {
    if (batchInfo[productUuid] || loadingBatch[productUuid]) return;
    
    setLoadingBatch(prev => ({ ...prev, [productUuid]: true }));
    try {
      const batches = await getProductBatches(productUuid);
      setTotalBatchCounts(prev => ({ ...prev, [productUuid]: batches.length }));
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

      const expiredFound = batches.some(
        (b: any) => (b.quantity || 0) > 0 && new Date(b.expiry_date) <= new Date()
      );
      setHasExpiredStock(prev => ({ ...prev, [productUuid]: expiredFound }));
      const expiredQty = batches
        .filter((b: any) => (b.quantity || 0) > 0 && new Date(b.expiry_date) <= new Date())
        .reduce((sum: number, b: any) => sum + (b.quantity || 0), 0);
      setExpiredQuantities(prev => ({ ...prev, [productUuid]: expiredQty }));
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
    
    // Fetch ALL batches (including expired) so the modal shows full info
    const allBatches = await getProductBatches(product.product_uuid);

    if (seq !== clickSeqRef.current) return;

    const batches = allBatches
      .filter((b: any) => (b.quantity || 0) > 0)
      .map((b: any) => ({
        batch_uuid: b.batch_uuid,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        selling_price: b.selling_price || b.ptr || 0,
        quantity: b.quantity || 0,
        is_expired: new Date(b.expiry_date) <= new Date(),
        available: b.quantity || 0,
        sold_quantity: b.sold_quantity || 0,
      }))
      .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

    const hasSellable = batches.some((b: any) => !b.is_expired);

    if (!hasSellable) {
      showToast(`"${product.name}" has expired and cannot be sold.`);
      return;
    }
    
    setSelectedProduct(product);
    setProductUnits(units);
    setProductBatches(batches);
    setShowUnitModal(true);
  };

  // Handle unit selection confirmation
  const handleUnitConfirm = (unitUuid: string, quantity: number, unitName: string, price: number, batchUuid?: string) => {
    if (selectedProduct) {
      onAddItemRef.current(selectedProduct, unitUuid, quantity, unitName, batchUuid);
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

  // Select a product: quick-add a row with the same defaults the modal used
  // (base unit, qty 1, earliest-expiry batch) so billing is never interrupted.
  // Unit/qty/batch can then be adjusted inline in the invoice grid.
  const selectProduct = async (product: Product, fromGrid = false) => {
    setDropOpen(false);
    setSearchTerm("");
    setActiveIdx(0);
    const seq = ++clickSeqRef.current;
    const units = await loadProductUnits(product.product_uuid);
    if (seq !== clickSeqRef.current) return;
    if (units.length === 0) {
      showToast(`No pack sizes defined for "${product.name}". Please add pack sizes first.`);
      return;
    }
    const base = units.find((u) => u.is_base_unit) || units[0];
    const allBatches = await getProductBatches(product.product_uuid);
    if (seq !== clickSeqRef.current) return;
    const withQty = (allBatches || [])
      .filter((b: any) => (b.quantity || 0) > 0)
      .map((b: any) => ({
        batch_uuid: b.batch_uuid,
        expiry_date: b.expiry_date,
        is_expired: new Date(b.expiry_date) <= new Date(),
      }))
      .sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
    const firstSellable = withQty.find((b: any) => !b.is_expired);
    if (!firstSellable) {
      showToast(`"${product.name}" has expired and cannot be sold.`);
      return;
    }
    onAddItemRef.current(product, base.unit_uuid, 1, base.unit_name, firstSellable.batch_uuid);
    setRecentUUIDs((prev) => {
      const filtered = prev.filter((id) => id !== product.product_uuid);
      return [product.product_uuid, ...filtered].slice(0, 20);
    });
    // Row focus is handled in CartItems: the new row's name cell takes
    // focus so the Enter chain (name → uom → qty → …) can start at once.
  };

  // The pos-add-product window listener is registered once — it must invoke
  // the LATEST selectProduct (which reads the latest onAddItem through its
  // own ref), never the first-render closure.
  const selectProductRef = useRef(selectProduct);
  selectProductRef.current = selectProduct;

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
  }, [products, cacheVersion]);

  // Server-side search when user types (debounced)
  useEffect(() => {
    if (searchTerm.trim().length < 1) {
      setSearchResults(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await searchProducts(searchTerm.trim(), 5);
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

  // Reset dropdown highlight when results change
  useEffect(() => {
    setActiveIdx(0);
  }, [filteredProducts]);

  // Keep the highlighted dropdown row visible while arrow-keying
  useEffect(() => {
    const el = dropListRef.current?.querySelector('[data-dd-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  // Prefetch batch info for server-search dropdown rows (top 5 only)
  useEffect(() => {
    const list = (searchResults ?? []).slice(0, 5);
    list.forEach(p => loadBatchInfoForProduct(p.product_uuid));
  }, [searchResults, cacheVersion]);

  // Ctrl+K to focus search (never while editing a grid cell) + external listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k' && !editing) {
        e.preventDefault();
        searchRef.current?.focus();
        // Select existing text so the cashier can immediately retype.
        searchRef.current?.select();
      }
    };
    const handleFocusSearch = () => {
      searchRef.current?.focus();
      searchRef.current?.select();
      setDropOpen(true);
    };
    const handleAddProduct = (e: Event) => {
      const d = (e as CustomEvent).detail;
      const product = d?.product ?? d;
      const fromGrid = !!d?.fromGrid;
      if (product?.product_uuid) selectProductRef.current(product, fromGrid);
    };
    // Global toast requests (e.g. F5 refresh confirmation) show as success.
    const handleToast = (e: Event) => {
      const message = (e as CustomEvent).detail;
      if (typeof message === "string" && message) showToast(message, 'success');
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pos-focus-search', handleFocusSearch);
    window.addEventListener('pos-add-product', handleAddProduct);
    window.addEventListener('pos-toast', handleToast);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pos-focus-search', handleFocusSearch);
      window.removeEventListener('pos-add-product', handleAddProduct);
      window.removeEventListener('pos-toast', handleToast);
    };
  }, []);

  if (loading && products.length === 0) {
    return (
      <div className="p-2">
        <div className="h-7 rounded-none bg-gray-200 animate-pulse" />
        <div className="mt-2 space-y-1.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 rounded-none bg-gray-200 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">

      {/* Custom Toast Notification */}
      <div
        className={`fixed top-5 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          toast.visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-3 pointer-events-none"
        }`}
      >
        <div className={`${toastTone === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white px-5 py-3 rounded-xl shadow flex items-center gap-3 text-sm font-medium`}>
          <HugeiconsIcon icon={AlertCircleIcon} className="text-lg shrink-0"  />
          <span>{toast.message}</span>
        </div>
      </div>

      {/* Search / product entry - results open as a dropdown; selecting adds a row to the invoice table */}
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <div className="absolute left-2 inset-y-0 flex items-center text-gray-500 pointer-events-none">
              <HugeiconsIcon icon={Search01Icon} className="text-sm"  />
            </div>
            <input
              ref={searchRef}
              type="text"
              placeholder={t('pos.searchProducts')}
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setDropOpen(true); }}
              onFocus={() => setDropOpen(true)}
              onBlur={() => setTimeout(() => setDropOpen(false), 120)}
              onKeyDown={(e) => {
                // Dropdown shows the first 5 matches only (speed + focus).
                const list = sortedProducts.slice(0, 5);
                if (e.key === 'ArrowDown' && list.length > 0) { e.preventDefault(); setDropOpen(true); setActiveIdx(i => Math.min(i + 1, list.length - 1)); }
                else if (e.key === 'ArrowUp' && list.length > 0) { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
                else if (e.key === 'Enter') {
                  // Results open: add the highlighted product.
                  // Ctrl+Shift+Enter here always means submit instead.
                  e.preventDefault();
                  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
                    window.dispatchEvent(new CustomEvent('pos-checkout-request'));
                  } else if (dropOpen && list.length > 0) {
                    selectProduct(list[Math.min(activeIdx, list.length - 1)]);
                  }
                }
                else if (e.key === 'Escape') { setSearchTerm(''); setDropOpen(false); }
              }}
              className="w-full pl-7 pr-16 py-2 text-xs border border-gray-300 rounded-none bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-transparent font-inter"
              autoComplete="off"
            />
            {searchTerm ? (
              <button
                onClick={() => { setSearchTerm(''); setDropOpen(false); searchRef.current?.focus(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 text-xs"
              >
                ✕
              </button>
            ) : (
              <kbd className="absolute right-1.5 top-1/2 -translate-y-1/2 px-1 py-px text-[9px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 rounded-none pointer-events-none whitespace-nowrap">
                Ctrl+K
              </kbd>
            )}
          </div>
          {searchLoading ? (
            <div className="animate-spin rounded-none h-4 w-4 border-b-2 border-green-500 shrink-0" />
          ) : searchTerm ? (
            <div className="text-[11px] text-gray-500 whitespace-nowrap shrink-0">
              {t('pos.foundProducts', { count: filteredProducts.length })}
            </div>
          ) : null}
        </div>
        {dropOpen && searchTerm.trim().length >= 1 && (
          <div ref={dropListRef} className="absolute left-0 right-0 top-full mt-1 z-50 max-h-72 overflow-y-auto bg-white border border-gray-300 rounded-md shadow">
            {sortedProducts.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 text-xs">
                <p>{t('pos.noProductsFound')}</p>
                <p className="mt-0.5">{t('pos.tryDifferentSearch')}</p>
              </div>
            ) : (
              sortedProducts.slice(0, 5).map((p, i) => {
                const productBatches = batchInfo[p.product_uuid] || [];
                const sellableStock = productBatches.length > 0
                  ? productBatches.reduce((sum, b) => sum + (b.quantity || 0), 0)
                  : (p.stock ?? 0);
                const onlyExpired = hasExpiredStock[p.product_uuid] && productBatches.length === 0;
                const isActive = i === activeIdx;
                return (
                  <div
                    key={p.product_uuid}
                    data-dd-active={isActive || undefined}
                    onMouseDown={(e) => { e.preventDefault(); selectProduct(p); }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 cursor-pointer text-[11px] leading-tight ${isActive ? 'bg-blue-50' : ''}`}
                  >
                    <span className="flex-1 min-w-0 truncate">
                      <span className="font-semibold text-gray-900">{p.name}</span>
                      {p.manufacturer && (
                        <span className="ml-1.5 text-gray-500">{p.manufacturer}</span>
                      )}
                      {p.prescription_required === 1 && (
                        <span className="ml-1.5 text-[9px] bg-red-500 text-white px-1 rounded-none font-medium">Rx</span>
                      )}
                    </span>
                    <span className="w-20 shrink-0 truncate text-gray-500">{p.sku || p.barcode || '—'}</span>
                    <span className={`w-14 shrink-0 text-right font-semibold ${onlyExpired || sellableStock === 0 ? 'text-red-500' : sellableStock < 10 ? 'text-amber-600' : 'text-green-600'}`}>
                      {onlyExpired ? 'Expired' : sellableStock}
                    </span>
                    <span className="w-16 shrink-0 text-right font-semibold text-gray-900">₹{p.price}</span>
                  </div>
                );
              })
            )}
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