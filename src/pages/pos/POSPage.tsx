import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import ProductGrid from "./components/ProductGrid";
import CartItems from "./components/CartItems";
import CartSummary from "./components/CartSummary";
import CustomerSelect from "./components/CustomerSelect";
import DiscountSection from "./components/DiscountSection";
import PaymentSection from "./components/PaymentSection";
import CustomerModal from "./modals/CustomerModal";
import SalesModal from "./modals/SalesModal";
import { useCart } from "./hooks/useCart";
import { usePosShortcuts } from "./hooks/usePosShortcuts";
import { useProducts } from "./hooks/useProducts";
import { useCustomers } from "./hooks/useCustomers";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Store01Icon,
} from "@hugeicons/core-free-icons";
import InvoiceReceipt from "./components/InvoiceReceipt";
import { getSettings } from "../../renderer/services/settingsApi";
import { getInvoice, getNextInvoice } from "../../renderer/services/saleApi";
import PrescriptionModal from "./components/PrescriptionModal";

function POSpage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);

  const [showPastInvoiceModal, setShowPastInvoiceModal] = useState(false);
  const [selectedPastInvoice, setSelectedPastInvoice] = useState<any>(null);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showNewBillConfirm, setShowNewBillConfirm] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", quantity: "1", price: "", gst: "0" });

  // REMOVED local prescription state - now coming from useCart

  // Refs for scrollable containers
  const cartItemsRef = useRef<HTMLDivElement>(null);
  const paymentSummaryRef = useRef<HTMLDivElement>(null);
  const barcodeScannedRef = useRef(false);

  const { products, loading: productsLoading, page, totalPages, goToPage, refetch } = useProducts();
  const {
    cartUUID,
    cartData,
    addItem,
    addCustomItem,
    increaseItem,
    decreaseItem,
    removeCartItem,
    updateItemQuantity,
    updateCartItem,
    changeItemBatch,
    changeItemUnit,
    applyDiscount,
    checkout,
    refreshCart,
    clearCart,
    discount,
    setDiscount,
    payments,
    setPayments,
    totalPaid,
    grandTotal,
    balance,
    loading: cartLoading,
    isCartInitializing,
    currentMethodRef,
    // Prescription modal props from useCart
    showPrescriptionModal,
    prescriptionProduct,
    handlePrescriptionSubmit,
    setShowPrescriptionModal,
    setPrescriptionProduct,
  } = useCart();

  // Currently selected invoice row (keyboard +/-/Delete operate on this)
  const selectedRowRef = useRef<any>(null);

  const {
    customers,
    selectedCustomer,
    setSelectedCustomer,
    createNewCustomer,
    loadSales,
    sales,
    refreshAllCustomerData,
  } = useCustomers();

  const [remarks, setRemarks] = useState("");
  const [nextBillNo, setNextBillNo] = useState<string | null>(null);
  const fetchNextBill = async () => {
    try {
      setNextBillNo(await getNextInvoice());
    } catch {
      setNextBillNo(null);
    }
  };
  useEffect(() => { fetchNextBill(); }, []);

  const [shopSettings, setShopSettings] = useState<any>(null);
  useEffect(() => {
    console.log("💰 Current payments state:", payments);
    console.log("💰 Current method ref:", currentMethodRef.current);
  }, [payments]);

  useEffect(() => {
    getSettings().then(res => {
      const s = res?.data || res;
      if (s?.shop_name) setShopSettings(s);
      if (s?.auto_print) setAutoPrint(!!s.auto_print);
    });
  }, []);

  // Save scroll positions function
  const saveScrollPositions = () => {
    const scrollState = {
      cartItems: cartItemsRef.current?.scrollTop || 0,
      paymentSummary: paymentSummaryRef.current?.scrollTop || 0,
    };
    sessionStorage.setItem('pos_scroll_positions', JSON.stringify(scrollState));
    console.log('Saved scroll positions:', scrollState);
  };

  const handleCheckout = async () => {
    console.log("🔵 handleCheckout called");

    if (!cartUUID || !cartData) {
      alert("Cart not ready. Please wait...");
      return;
    }

    const cartStatus = cartData?.status || cartData?.cart?.status;
    if (cartStatus === 'completed') {
      await refreshCart();
      alert("Cart was already processed. Please try again.");
      return;
    }

    const cartItems = cartData?.cart?.items || cartData?.items;
    if (!cartItems || cartItems.length === 0) {
      alert("No items in cart");
      return;
    }

    const isCreditPayment = currentMethodRef.current === 'pay_later';
    if (isCreditPayment && !selectedCustomer) {
      alert("Please select a customer for Pay Later option");
      return;
    }

    const forcedPayments = [{
      method: currentMethodRef.current,
      amount: grandTotal
    }];

    const result = await checkout(
      forcedPayments,
      selectedCustomer?.customer_uuid || null,
      selectedCustomer,
      remarks.trim() || undefined
    );

    console.log("🔵 Checkout result:", result);

    // Show invoice if checkout was successful
    if (result && result.success && result.invoice) {
      console.log("✅ Checkout successful! Showing invoice...");
      window.dispatchEvent(new Event('refresh-dashboard'));
      window.dispatchEvent(new Event('refresh-customers'));
      if (refreshAllCustomerData) {
        await refreshAllCustomerData();
      }
      setInvoiceData(result.invoice);
      setShowInvoiceModal(true);
    } else if (result === null) {
      // Checkout is waiting for prescription or was cancelled
      console.log("Checkout waiting for prescription or was cancelled");
    } else {
      console.log("Checkout failed");
    }
  };

  // Check cart status
  useEffect(() => {
    const checkCartStatus = async () => {
      if (cartData) {
        const status = cartData?.status || cartData?.cart?.status;
        console.log("Current cart status:", status);

        if (status === 'completed') {
          console.log("Cart completed, refreshing...");
          await refreshCart();
        }
      }
    };

    checkCartStatus();
  }, [cartData, refreshCart]);

  // Barcode scanner listener
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
          try {
            const res = await fetch(`http://127.0.0.1:3000/api/products/barcode/${barcodeBuffer}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            if (!res.ok) {
              throw new Error(`Server returned ${res.status}`);
            }
            const data = await res.json();
            if (data.success && data.data) {
              await addItem(data.data);
            } else {
              alert(`Product not found for barcode: ${barcodeBuffer}`);
            }
          } catch (err) {
            console.error('Barcode lookup failed:', err);
            alert('Barcode scanning not available. Please search for the product manually.');
          }
          barcodeScannedRef.current = true;
          setTimeout(() => {
            barcodeScannedRef.current = false;
          }, 100);
        }
        barcodeBuffer = '';
      } else if (timeDiff < 50) {
        barcodeBuffer += e.key;
      } else {
        barcodeBuffer = e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addItem]);

  // Keyboard shortcut: Ctrl+Enter to checkout (plain Enter drives grid cells)
  useEffect(() => {
    const handleCheckoutShortcut = (e: KeyboardEvent) => {
      if (showCustomerModal || showSalesModal || showInvoiceModal || showPastInvoiceModal || showCustomModal || showPrescriptionModal || showNewBillConfirm) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
        return;
      }

      if (barcodeScannedRef.current) {
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCheckout();
      }
    };

    window.addEventListener('keydown', handleCheckoutShortcut);
    return () => window.removeEventListener('keydown', handleCheckoutShortcut);
  }, [
    showCustomerModal,
    showSalesModal,
    showInvoiceModal,
    showPastInvoiceModal,
    showCustomModal,
    showPrescriptionModal,
    showNewBillConfirm,
    cartLoading,
    isCartInitializing,
    cartData
  ]);

  // Save scroll positions on scroll
  useEffect(() => {
    const handleCartScroll = () => saveScrollPositions();
    const handlePaymentScroll = () => saveScrollPositions();

    const cartElement = cartItemsRef.current;
    const paymentElement = paymentSummaryRef.current;

    if (cartElement) {
      cartElement.addEventListener('scroll', handleCartScroll);
    }
    if (paymentElement) {
      paymentElement.addEventListener('scroll', handlePaymentScroll);
    }

    return () => {
      if (cartElement) {
        cartElement.removeEventListener('scroll', handleCartScroll);
      }
      if (paymentElement) {
        paymentElement.removeEventListener('scroll', handlePaymentScroll);
      }
    };
  }, [cartData]);

  useEffect(() => {
    return () => {
      saveScrollPositions();
    };
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', saveScrollPositions);
    return () => {
      window.removeEventListener('beforeunload', saveScrollPositions);
    };
  }, []);

  useEffect(() => {
    const restoreTimer = setTimeout(() => {
      const savedPositions = sessionStorage.getItem('pos_scroll_positions');

      if (savedPositions) {
        try {
          const { cartItems, paymentSummary } = JSON.parse(savedPositions);

          if (cartItemsRef.current && cartItems > 0) {
            cartItemsRef.current.scrollTop = cartItems;
          }
          if (paymentSummaryRef.current && paymentSummary > 0) {
            paymentSummaryRef.current.scrollTop = paymentSummary;
          }
        } catch (error) {
          console.error('Error restoring scroll positions:', error);
        }
      }
    }, 150);

    return () => clearTimeout(restoreTimer);
  }, []);

  // (Removed: old standalone F5 handler — F5 now lives in usePosShortcuts
  // with a visible toast so the refresh is always confirmable.)

  // New-bill flow: in-app confirm (never native confirm), then clear.
  // Escape cancels the confirm dialog.
  useEffect(() => {
    if (!showNewBillConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNewBillConfirm(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showNewBillConfirm]);
  const doNewBill = () => {
    setShowNewBillConfirm(false);
    clearCart();
    selectedRowRef.current = null;
    window.dispatchEvent(new CustomEvent("pos-focus-search"));
  };
  useEffect(() => {
    const onNewBill = () => {
      if ((cartData?.cart?.items?.length || 0) > 0) {
        setShowNewBillConfirm(true);
      } else {
        doNewBill();
      }
    };
    window.addEventListener("pos-new-bill-request", onNewBill);
    return () =>
      window.removeEventListener("pos-new-bill-request", onNewBill);
  }, [cartData, clearCart]);

  // ─── Central workstation shortcuts (F2/F3/F4/F5/F6–F10, +/-, Delete) ──────────
  // Enter, arrows, Ctrl+K, barcode keep their existing dedicated
  // handlers; this hook only adds the workstation layer on top.
  usePosShortcuts({
    refreshProducts: () => {
      refetch();
      window.dispatchEvent(
        new CustomEvent("pos-toast", { detail: "Product list refreshed" })
      );
    },
    hasLines: (cartData?.cart?.items?.length || 0) > 0,
    modalsOpen:
      showCustomerModal ||
      showSalesModal ||
      showInvoiceModal ||
      showPastInvoiceModal ||
      showCustomModal ||
      showPrescriptionModal ||
      showNewBillConfirm,
    getSelectedItem: () => selectedRowRef.current,
    clearSelectedItem: () => {
      selectedRowRef.current = null;
    },
    increaseSelected: () => {
      const it = selectedRowRef.current;
      if (it) increaseItem(it);
    },
    decreaseSelected: () => {
      const it = selectedRowRef.current;
      if (it) decreaseItem(it);
    },
    removeSelected: () => {
      const it = selectedRowRef.current;
      if (it) {
        removeCartItem(it);
        selectedRowRef.current = null;
      }
    },
    newBill: () => {
      // The actual clear lives in POSPage behind an in-app confirm dialog.
      // Never use native window.confirm here — it wedges Electron input.
      window.dispatchEvent(new CustomEvent("pos-new-bill-request"));
    },
  });


  const handleCheckoutRef = useRef(handleCheckout);
  handleCheckoutRef.current = handleCheckout;
  // Silently ignore checkout requests on an empty cart (avoids alert spam).
  const hasLinesRef = useRef(false);
  hasLinesRef.current = (cartData?.cart?.items?.length || 0) > 0;
  useEffect(() => {
    const onRequest = () => {
      if (!hasLinesRef.current) return;
      if (
        showCustomerModal ||
        showSalesModal ||
        showInvoiceModal ||
        showPastInvoiceModal ||
        showCustomModal ||
        showPrescriptionModal ||
        showNewBillConfirm
      ) {
        return;
      }
      handleCheckoutRef.current();
    };
    window.addEventListener("pos-checkout-request", onRequest);
    return () =>
      window.removeEventListener("pos-checkout-request", onRequest);
  }, [
    showCustomerModal,
    showSalesModal,
    showInvoiceModal,
    showPastInvoiceModal,
    showCustomModal,
    showPrescriptionModal,
    showNewBillConfirm,
  ]);

  if (isCartInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-white text-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-900">Initializing cart...</p>
        </div>
      </div>
    );
  }

  const handleAddCustom = async () => {
    const ok = await addCustomItem({
      name: customForm.name.trim(),
      quantity: Math.max(1, parseInt(customForm.quantity) || 0),
      price: parseFloat(customForm.price) || 0,
      gst_percent: Math.min(100, Math.max(0, parseFloat(customForm.gst) || 0)),
    });
    if (ok) {
      setCustomForm({ name: "", quantity: "1", price: "", gst: "0" });
      setShowCustomModal(false);
    }
  };

  const handleCloseInvoice = () => {
    setShowInvoiceModal(false);
    setInvoiceData(null);
    setPayments([{ method: "cash", amount: 0 }]);
    setDiscount(0);
    setSelectedCustomer(null);
    setRemarks("");
    selectedRowRef.current = null;
    fetchNextBill();
    refetch();
    // Fresh bill: cashier starts typing the next one immediately.
    window.dispatchEvent(new CustomEvent("pos-focus-search"));
  };

  // Checkout requested from inside a grid/cash input (Enter there).
  // handleCheckout already validates cart, customer, and payment state.

  return (
    <div className="h-screen w-screen flex flex-col bg-white text-gray-900 font-inter overflow-hidden">
      {/* 1 ─ TOP HEADER AREA (existing TopBar, untouched) */}
      <header className="shrink-0">
        <TopBar
          onShowSales={() => {
            loadSales();
            setShowSalesModal(true);
          }}
        />
      </header>

      {/* 2 ─ BILL PARTIES (boxed seller / buyer cards + invoice meta) */}
      <section className="shrink-0 px-2 py-1 border-b border-gray-200 bg-gray-50 text-sm leading-snug">
        <div className="border border-gray-300 bg-white grid grid-cols-2 text-sm font-bold text-gray-900 text-left">
          <div className="px-2 py-1 min-w-0">
            <div className="truncate text-lg">FROM</div>
            <div className="truncate">
              name: {shopSettings?.shop_name || 'My Store'}
            </div>
            <div className="truncate">
              address: {shopSettings?.address || ''}
            </div>
            <div className="truncate">
              GSTIN: {shopSettings?.gstin || ''}
            </div>
            <div className="truncate">
              Drug Lic: {shopSettings?.drug_license_number || ''}
            </div>
          </div>
          <div className="px-2 py-1 min-w-0 border-l border-gray-300">
            <div className="truncate text-lg">TO</div>
            <div className="truncate">
              name: {selectedCustomer?.name || 'Walk-in'}
            </div>
            <div className="truncate">
              phone: {selectedCustomer?.mobile || ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 px-1 pt-1 text-gray-600 text-left">
          <span>
            Invoice No: <span className="font-semibold text-gray-900">{nextBillNo || ''}</span>
          </span>
          <span>
            Date: <span className="font-semibold text-gray-900">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
          </span>
          <span>
            Payment: <span className="font-semibold text-gray-900">{({ cash: 'Cash', upi: 'UPI', pay_later: 'Pay Later', card: 'Card' } as Record<string, string>)[payments?.[0]?.method] || payments?.[0]?.method || 'Cash'}</span>
          </span>
        </div>
      </section>

      {/* 3 ─ PRODUCT SEARCH / ENTRY (selecting adds a new row to the invoice table below) */}
      <section className="shrink-0 px-2 py-1 border-b border-gray-200 bg-white text-gray-900">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
        <ProductGrid
          products={products}
          loading={productsLoading}
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
          onAddItem={(product, unitUuid, quantity, unitName, batchUuid) => {
            addItem(product, unitUuid, quantity, unitName, batchUuid);
          }}
        />
          </div>
          <button
            onClick={() => setShowCustomModal(true)}
            className="shrink-0 self-stretch px-3 text-xs font-semibold text-gray-700 border border-gray-300 hover:border-gray-400 rounded-none transition-colors flex items-center"
            title="Add a custom (ad-hoc) item row"
          >
            + Add Item
          </button>
        </div>
      </section>

      {/* 4 ─ MAIN INVOICE TABLE (one row = one product, full width) */}
      <main className="flex-1 min-h-0 flex flex-col p-2 overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col bg-gray-50 border border-gray-200 rounded-none overflow-hidden">
          <div className="px-3 py-1.5 font-bold text-gray-900 text-sm text-start border-b border-gray-200 flex justify-between items-center shrink-0">
            <span>Invoice Items</span>
            <span className="text-xs font-normal text-gray-500">
              {cartData?.cart?.items?.length || 0} lines
            </span>
          </div>
          <div
            ref={cartItemsRef}
            className="flex-1 overflow-auto scrollbar-hide min-h-0 relative"
            id="cart-scroll-container"
          >
            {/* CartItems stays mounted across refreshes: unmounting it would
                reset row state, drafts, and keyboard focus on every add. */}
            <CartItems
              items={cartData?.cart?.items || []}
              onIncrease={increaseItem}
              onDecrease={decreaseItem}
              onUpdateQty={updateItemQuantity}
              onUpdateField={updateCartItem}
              onChangeBatch={changeItemBatch}
              onChangeUnit={changeItemUnit}
              onSelectRow={(item) => {
                selectedRowRef.current = item;
              }}
            />
            {cartLoading && (
              <div className="absolute inset-0 z-20 flex items-start justify-center bg-white/60 pointer-events-none">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mt-10" />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 5 ─ CHECKOUT BAR (single compact workspace: totals · customer · discount · payment · actions) */}
      <section className="shrink-0 border-t border-gray-200 bg-gray-50">
        <div
          ref={paymentSummaryRef}
          className="grid grid-cols-[35%_35%_30%] items-center gap-4 px-3 pt-1.5 overflow-x-clip"
          id="payment-scroll-container"
        >
          {/* TOTALS */}
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-gray-500 text-center">Totals</div>
            <CartSummary
              total={cartData?.summary?.total || 0}
              tax={cartData?.summary?.tax || 0}
              grandTotal={grandTotal}
            />
          </div>
          {/* CUSTOMER + DISCOUNT (single middle column) */}
          <div className="min-w-0 space-y-1.5">
            <div>
              <div className="text-[11px] font-semibold text-gray-500 text-center">Customer</div>
              <CustomerSelect
                customers={customers}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                onAddNew={(phone) => { setNewCustomerPhone(phone || ""); setShowCustomerModal(true); }}
              />
            </div>
            <div>
              <DiscountSection
                discount={discount}
                onDiscountChange={setDiscount}
                onApplyDiscount={() => applyDiscount(cartUUID, discount)}
              />
            </div>
          </div>
          {/* PAYMENT */}
          <div className="min-w-0">
            <PaymentSection
              payments={payments}
              onPaymentChange={(index, field, value) => {
                const updated = [...payments];
                updated[index] = { ...updated[index], [field]: value };
                setPayments(updated);

                if (field === "method") {
                  currentMethodRef.current = value;
                }
              }}
              onAddRow={() =>
                setPayments([...payments, { method: "upi", amount: 0 }])
              }
              onRemoveRow={(index) => {
                const updated = payments.filter((_, i) => i !== index);
                setPayments(updated);
              }}
              totalPaid={totalPaid}
              balance={balance}
              grandTotal={grandTotal}
            />
          </div>
        </div>
        {/* ACTION ROW */}
        <div className="flex items-center gap-1.5 px-3 py-1 mt-1 border-t border-gray-200">
          <button
            className="bg-green-600 text-white px-4 py-1 rounded-none font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 transition-colors text-xs"
            onClick={handleCheckout}
            disabled={cartLoading || !cartData?.cart?.items?.length || isCartInitializing}
          >
            {cartLoading ? "Processing..." : "Submit [Ctrl+Enter]"}
          </button>
          {(cartData?.cart?.items?.length || 0) > 0 && (
            <button
              onClick={clearCart}
              className="px-3 py-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-none transition-all"
            >
              Reset
            </button>
          )}
          {selectedCustomer?.credit_balance > 0 && (
            <button
              className="px-3 py-1 text-xs bg-orange-500 text-white rounded-none hover:bg-orange-600 transition-colors"
              onClick={() => {
                setPayments([
                  { method: "cash", amount: selectedCustomer.credit_balance },
                ]);
              }}
            >
              Clear Old Due ₹{selectedCustomer.credit_balance}
            </button>
          )}
          <div className="ml-auto">
            <button
              className="px-3 py-1 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 rounded-none transition-colors"
              onClick={() => {
                loadSales();
                setShowSalesModal(true);
              }}
            >
              View
            </button>
          </div>
        </div>
      </section>
      {/* Modals */}
      {showNewBillConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowNewBillConfirm(false)}
        >
          <div
            className="w-[300px] bg-white border border-gray-300 rounded-none p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-900">Start a new bill?</div>
            <p className="text-xs text-gray-500 mt-1">
              The current bill items will be cleared. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowNewBillConfirm(false)}
                className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-none hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                autoFocus
                onClick={doNewBill}
                className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-none hover:bg-green-700 transition-colors"
              >
                Clear & New
              </button>
            </div>
          </div>
        </div>
      )}
      {showCustomModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowCustomModal(false)}
        >
          <div
            className="w-[320px] bg-white border border-gray-300 rounded-none p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold text-gray-900 mb-2">Add Custom Item</div>
            <label className="block text-[11px] text-gray-500 mb-0.5">Name *</label>
            <input
              value={customForm.name}
              onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Delivery charge"
              className="w-full mb-2 px-2 py-1 text-xs bg-white border border-gray-300 rounded-none text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-500"
              autoComplete="off"
            />
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">Qty *</label>
                <input
                  type="number"
                  min="1"
                  value={customForm.quantity}
                  onChange={(e) => setCustomForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded-none text-gray-900 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">Rate *</label>
                <input
                  type="number"
                  min="0"
                  value={customForm.price}
                  onChange={(e) => setCustomForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded-none text-gray-900 focus:outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-500 mb-0.5">GST%</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={customForm.gst}
                  onChange={(e) => setCustomForm((f) => ({ ...f, gst: e.target.value }))}
                  className="w-full px-2 py-1 text-xs bg-white border border-gray-300 rounded-none text-gray-900 focus:outline-none focus:border-green-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCustomModal(false)}
                className="px-3 py-1 text-xs text-gray-600 border border-gray-300 rounded-none hover:border-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCustom}
                disabled={!customForm.name.trim() || cartLoading}
                className="px-3 py-1 text-xs font-bold text-white bg-green-600 rounded-none hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add Row
              </button>
            </div>
          </div>
        </div>
      )}
      {showCustomerModal && (
        <CustomerModal
          initialMobile={newCustomerPhone}
          onClose={() => { setShowCustomerModal(false); setNewCustomerPhone(""); }}
          onCreateCustomer={async (customerData) => {
            const newCustomer = await createNewCustomer(customerData);
            setSelectedCustomer(newCustomer);
            setShowCustomerModal(false);
            setNewCustomerPhone("");
          }}
        />
      )}

      {showSalesModal && (
        <SalesModal
          sales={sales}
          onClose={() => setShowSalesModal(false)}
          onRefresh={loadSales}
          onViewInvoice={async (saleUUID) => {
            const sale = sales.find(s => s.sale_uuid === saleUUID);

            if (!sale) {
              alert('Sale not found');
              return;
            }

            try {
              const fullInvoice = await getInvoice(saleUUID);
              if (fullInvoice && fullInvoice.items && fullInvoice.items.length > 0) {
                setSelectedPastInvoice(fullInvoice);
                setShowPastInvoiceModal(true);
                return;
              }
            } catch (err) {
              console.error('Failed to fetch from API:', err);
            }

            const constructedInvoice = {
              sale_uuid: sale.sale_uuid,
              invoice_no: sale.invoice_number || sale.invoice_no,
              created_at: sale.created_at,
              customer: {
                name: 'Walk-in Customer',
                customer_uuid: sale.customer_uuid
              },
              items: [{
                product_name: 'Sale Items',
                quantity: 1,
                price: sale.total,
                total: sale.total
              }],
              summary: {
                total: sale.total || 0,
                tax: sale.tax || 0,
                grand_total: sale.grand_total || sale.total || 0
              },
              payments: [{
                method: 'cash',
                amount: sale.grand_total || sale.total || 0
              }]
            };

            setSelectedPastInvoice(constructedInvoice);
            setShowPastInvoiceModal(true);
          }}
        />
      )}

      {showInvoiceModal && invoiceData && (
        <InvoiceReceipt
          invoice={invoiceData}
          onClose={handleCloseInvoice}
          autoPrint={autoPrint}
        />
      )}

      {showPastInvoiceModal && selectedPastInvoice && (
        <InvoiceReceipt
          invoice={selectedPastInvoice}
          onClose={() => {
            setShowPastInvoiceModal(false);
            setSelectedPastInvoice(null);
          }}
          autoPrint={false}
        />
      )}

      {/* Prescription Modal - Single instance */}
      {showPrescriptionModal && prescriptionProduct && (
        <PrescriptionModal
          isOpen={showPrescriptionModal}
          productName={prescriptionProduct.name}
          productSchedule={prescriptionProduct.schedule_type || 'H'}
          onClose={() => {
            setShowPrescriptionModal(false);
            setPrescriptionProduct(null);
          }}
          onConfirm={handlePrescriptionSubmit}
        />
      )}
    </div>
  );
}

export default POSpage;