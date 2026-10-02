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
import InventoryModal from "./modals/InventoryModal";
import { useCart } from "./hooks/useCart";
import { usePosShortcuts } from "./hooks/usePosShortcuts";
import { useProducts } from "./hooks/useProducts";
import { useCustomers } from "./hooks/useCustomers";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Store01Icon,
} from "@hugeicons/core-free-icons";
import { Trash2, ShoppingCart, ReceiptText, Banknote, ChevronDown, User, Plus, Calendar } from "lucide-react";
import { Card, ShortcutBadge } from "./components/posUi";
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
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  // false = unsaved draft preview; nothing is written until Save is pressed.
  const [invoiceSaved, setInvoiceSaved] = useState(false);
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
  // Guards double-Submit (two rapid Save clicks must not create two sales).
  const savingRef = useRef(false);

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
  const [billPhone, setBillPhone] = useState("");
  const [billName, setBillName] = useState("");
  // Keep the bill name/phone in step with the chosen customer. Typing a full
  // number that matches a customer selects them; otherwise the typed values
  // ride along on the bill itself (walk-in overrides, stored on the sale),
  // and a custom name is auto-saved to the customer list at checkout.
  useEffect(() => {
    setBillPhone(selectedCustomer?.mobile ? String(selectedCustomer.mobile).replace(/\D/g, '') : "");
    setBillName(selectedCustomer?.name || "");
  }, [selectedCustomer?.customer_uuid]);
  const [nextBillNo, setNextBillNo] = useState<string | null>(null);
  const fetchNextBill = async () => {
    try {
      setNextBillNo(await getNextInvoice());
    } catch {
      setNextBillNo(null);
    }
  };
  useEffect(() => { fetchNextBill(); }, []);
  useEffect(() => {
    console.log('[POS] loaded: draft-flow + save-button + cart-ref + ctrl-enter build');
  }, []);

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

  // Review step: builds an unsaved draft preview from the live cart.
  // Nothing is written to the database, stock, ledger, or dashboard here —
  // that happens only when Save is pressed inside the invoice modal.
  const handleReview = () => {
    if (!cartUUID || !cartData) {
      alert("Cart not ready. Please wait...");
      return;
    }

    const cartStatus = cartData?.status || cartData?.cart?.status;
    if (cartStatus === 'completed') {
      alert("Cart was already processed. Please try again.");
      return;
    }

    const cartItems = cartData?.cart?.items || cartData?.items;
    if (!cartItems || cartItems.length === 0) {
      alert("No items in cart");
      return;
    }

    if (currentMethodRef.current === 'pay_later' && !selectedCustomer && !billName.trim()) {
      alert("Please select a customer for Pay Later option");
      return;
    }

    const summary = cartData?.summary || cartData?.cart?.summary || {};
    const draft = {
      invoice_number: nextBillNo || 'DRAFT',
      created_at: new Date().toISOString(),
      isDraft: true,
      customer: selectedCustomer
        ? {
            name: selectedCustomer.name,
            mobile: selectedCustomer.mobile || billPhone || '',
            address: selectedCustomer.address || '',
            gstin: selectedCustomer.gstin || '',
          }
        : {
            name: billName.trim() || 'Walk-in Customer',
            mobile: billPhone || '',
          },
      shop: shopSettings || {},
      items: cartItems.map((ci: any) => ({
        product_name: ((ci.product?.name || 'Unknown') as string).replace('[Custom] ', ''),
        quantity: ci.quantity,
        price: ci.price,
        total: Number(ci.price) * Number(ci.quantity),
        hsn_code: ci.product?.hsn_code || '',
        gst_percent: ci.tax_percent || 0,
        batch_number: '',
        manufacturer: ci.product?.manufacturer || '',
        expiry: '',
        unit: '',
      })),
      summary: {
        subtotal: Number(summary.total || 0),
        tax: Number(summary.tax || 0),
        grand_total: grandTotal,
      },
      discount,
      payments: [{ method: currentMethodRef.current, amount: grandTotal }],
    };

    setInvoiceData(draft);
    setInvoiceSaved(false);
    setShowInvoiceModal(true);
  };

  const handleCheckout = async () => {
    console.log("🔵 handleCheckout called");
    if (savingRef.current) return;
    savingRef.current = true;
    console.log("🔵 handleCheckout called");
    console.log("🔵 checkout customer:", selectedCustomer?.customer_uuid || null);

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

    const typedName = billName.trim();
    const selectedName = selectedCustomer?.name || '';
    let custUuid = selectedCustomer?.customer_uuid || null;
    let custCustomer = selectedCustomer;

    // Custom typed name: save it to the customer list automatically (with the
    // typed number when present). Whatever happens, the typed values also ride
    // on the bill itself, so the invoice is correct for every role — even when
    // customer creation is not permitted and silently falls through.
    if (typedName && typedName.toLowerCase() !== 'walk-in' && typedName !== selectedName) {
      const dup = billPhone.length === 10
        ? (customers || []).find((c: any) => String(c.mobile || '').replace(/\D/g, '') === billPhone)
        : undefined;
      if (dup) {
        custUuid = dup.customer_uuid;
        custCustomer = dup;
        setSelectedCustomer(dup);
      } else {
        try {
          const created: any = await createNewCustomer({
            name: typedName,
            mobile: billPhone.length === 10 ? billPhone : '',
          });
          const rec = created?.customer_uuid ? created : created?.data;
          if (rec?.customer_uuid) {
            custUuid = rec.customer_uuid;
            custCustomer = rec;
            setSelectedCustomer(rec);
          }
        } catch {
          // fall through: typed name/phone still go on the bill as overrides
        }
      }
    }

    const isCreditPayment = currentMethodRef.current === 'pay_later';
    if (isCreditPayment && !custUuid) {
      alert("Please select a customer for Pay Later option");
      return;
    }

    const forcedPayments = [{
      method: currentMethodRef.current,
      amount: grandTotal
    }];

    const result = await checkout(
      forcedPayments,
      custUuid,
      custCustomer,
      remarks.trim() || undefined,
      billPhone || undefined,
      typedName && typedName.toLowerCase() !== 'walk-in' ? typedName : undefined
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
      setInvoiceSaved(true);
      setShowInvoiceModal(true);
    } else if (result === null) {
      // Checkout is waiting for prescription or was cancelled
      console.log("Checkout waiting for prescription or was cancelled");
    } else {
      console.log("Checkout failed");
    }
    savingRef.current = false;
  };

  // Always-fresh entries: effects below must call through these refs,
  // never render closures (closures go stale when cart/modal state changes
  // without re-subscribing their effects — e.g. customer picked after add).
  // Submit (button or Ctrl+Enter) always opens the unsaved draft review;
  // only the modal's Save button performs the real checkout.
  const handleCheckoutRef = useRef(handleCheckout);
  handleCheckoutRef.current = handleCheckout;
  const handleReviewRef = useRef(handleReview);
  handleReviewRef.current = handleReview;

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

      // Modifier chords (Ctrl+Enter submit etc.) are shortcuts, never scans.
      if (e.ctrlKey || e.metaKey || e.altKey) {
        barcodeBuffer = '';
        return;
      }

      // Only single printable characters feed the scan buffer. Anything else
      // (arrows, F-keys, bare modifiers) resets it, so key names can never
      // accumulate into a fake barcode lookup.
      if (e.key !== 'Enter' && e.key.length !== 1) {
        barcodeBuffer = '';
        return;
      }

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

  // Keyboard shortcuts: Ctrl+Enter submits (draft review), Ctrl+Shift+Enter
  // clears via the confirm flow (plain Enter drives grid cells).
  // Both are honored even from inside inputs.
  useEffect(() => {
    const handleCheckoutShortcut = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (showCustomerModal || showSalesModal || showInventoryModal || showInvoiceModal || showPastInvoiceModal || showCustomModal || showPrescriptionModal || showNewBillConfirm) {
        return;
      }

      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleReviewRef.current();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        // Same confirm-then-clear flow as the Clear button.
        // Never use native window.confirm here — it wedges Electron input.
        window.dispatchEvent(new CustomEvent("pos-new-bill-request"));
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

  // (Removed: old standalone F5 handler — F5 now opens View Bill,
  // and product refresh happens automatically after save/close.)

  // New-bill flow: in-app confirm (never native confirm), then clear.
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
    window.dispatchEvent(new CustomEvent("pos-focus-grid"));
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

  // ─── Central workstation shortcuts ─────────────────────────────────────────
  // F2 scan, F3 quick keys, F5 view bill, F4/F6–F10, Ctrl+I, Ctrl+C/U/P/D.
  // Enter, arrows, Ctrl+K, barcode keep their existing dedicated
  // handlers; this hook only adds the workstation layer on top.
  usePosShortcuts({
    openSales: () => {
      loadSales();
      setShowSalesModal(true);
    },
    hasLines: (cartData?.cart?.items?.length || 0) > 0,
    modalsOpen:
      showCustomerModal ||
      showSalesModal ||
      showInventoryModal ||
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
  });


  // Silently ignore checkout requests on an empty cart (avoids alert spam).
  // (handleCheckoutRef is declared once, right after handleCheckout above.)
  const hasLinesRef = useRef(false);
  hasLinesRef.current = (cartData?.cart?.items?.length || 0) > 0;
  useEffect(() => {
    const onRequest = () => {
      if (!hasLinesRef.current) return;
      if (
        showCustomerModal ||
        showSalesModal ||
        showInventoryModal ||
        showInvoiceModal ||
        showPastInvoiceModal ||
        showCustomModal ||
        showPrescriptionModal ||
        showNewBillConfirm
      ) {
        return;
      }
      // Review first — the modal's Save button performs the real checkout.
      handleReviewRef.current();
    };
    window.addEventListener("pos-checkout-request", onRequest);
    return () =>
      window.removeEventListener("pos-checkout-request", onRequest);
  }, [
    showCustomerModal,
    showSalesModal,
    showInventoryModal,
    showInvoiceModal,
    showPastInvoiceModal,
    showCustomModal,
    showPrescriptionModal,
    showNewBillConfirm,
  ]);

  // Inventory lookup: Ctrl+I (or the Stock button) opens it on top of POS.
  useEffect(() => {
    const onOpenInventory = () => setShowInventoryModal(true);
    window.addEventListener("pos-open-inventory", onOpenInventory);
    return () =>
      window.removeEventListener("pos-open-inventory", onOpenInventory);
  }, []);

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
    setInvoiceSaved(false);
    savingRef.current = false;
    setPayments([{ method: "cash", amount: 0 }]);
    setDiscount(0);
    setSelectedCustomer(null);
    setRemarks("");
    selectedRowRef.current = null;
    fetchNextBill();
    refetch();
    // Fresh bill: cashier continues typing in the spreadsheet.
    window.dispatchEvent(new CustomEvent("pos-focus-grid"));
  };

  // Checkout requested from inside a grid/cash input (Enter there).
  // handleCheckout already validates cart, customer, and payment state.

  return (
    <div className="h-screen w-screen flex flex-col gap-3 bg-[#F6F8FB] text-[#1E293B] font-inter overflow-hidden p-4 text-sm">
      {/* TOP NAV (global app chrome: tabs, EOD, sales, alerts, user) */}
      <header className="shrink-0">
        <TopBar
          onShowSales={() => {
            loadSales();
            setShowSalesModal(true);
          }}
        />
      </header>

      {/* [1] HEADER CARD: invoice meta + payment + customer */}
      <Card className="shrink-0 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="w-[260px] shrink-0">
            <label className="block text-[13px] font-medium text-[#64748B] mb-1">Invoice No:</label>
            <input
              value={nextBillNo || ''}
              readOnly
              tabIndex={-1}
              className="w-full h-10 px-3 text-sm font-semibold text-[#1E293B] bg-[#EEF1F5] border border-[#D5DBE5] rounded-lg outline-none cursor-default"
            />
          </div>
          <div className="w-[185px] shrink-0">
            <label className="block text-[13px] font-medium text-[#64748B] mb-1">Date:</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#64748B] pointer-events-none" />
              <input
                value={new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                readOnly
                tabIndex={-1}
                title="Bill date defaults to today"
                className="w-full h-10 pl-10 pr-3 text-sm text-[#1E293B] bg-white border border-[#D5DBE5] rounded-lg outline-none cursor-default"
              />
            </div>
          </div>
          <div className="w-[220px] shrink-0">
            <label className="block text-[13px] font-medium text-[#64748B] mb-1">Payment:</label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#64748B] pointer-events-none" />
              <select
                value={payments?.[0]?.method || 'cash'}
                onChange={(e) => window.dispatchEvent(new CustomEvent("pos-select-payment", { detail: e.target.value }))}
                className="w-full h-10 pl-10 pr-8 text-sm font-medium text-[#1E293B] bg-white border border-[#D5DBE5] rounded-lg outline-none appearance-none cursor-pointer focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/30"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="pay_later">Pay Later</option>
                <option value="card">Card</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B] pointer-events-none" />
            </div>
          </div>
          <div className="self-stretch w-px bg-[#E5E9F0] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-[#1E293B] mb-1 truncate">
              {selectedCustomer?.name || 'Walk-in Customer'}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <CustomerSelect
                  layout="inline"
                  listenF4={false}
                  customers={customers}
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={setSelectedCustomer}
                  displayName={billName}
                  onAddNew={(phone) => { setNewCustomerPhone(phone || ""); setShowCustomerModal(true); }}
                />
              </div>
              <button
                onClick={() => { setNewCustomerPhone(""); setShowCustomerModal(true); }}
                title="Quick-add customer (name + phone)"
                className="w-10 h-10 shrink-0 bg-white border border-[#D5DBE5] rounded-lg text-[#1E293B] hover:border-[#16A34A] hover:text-[#16A34A] transition-colors flex items-center justify-center"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* [2] PRODUCT SEARCH ROW (search + Scan + Quick Keys + Stock live in ProductGrid) */}
      <section className="shrink-0">
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
      </section>

      {/* [3] INVOICE ITEMS TABLE CARD (only the body scrolls) */}
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Card className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
          <div className="h-9 shrink-0 px-4 flex justify-end items-center border-b border-[#E5E9F0]">
            <span className="text-xs font-medium text-[#64748B]">
              {cartData?.cart?.items?.length || 0} lines
            </span>
          </div>
          <div
            ref={cartItemsRef}
            className="flex-1 overflow-auto min-h-0 relative"
            id="cart-scroll-container"
          >
            {/* CartItems stays mounted across refreshes: unmounting it would
                reset row state, drafts, and keyboard focus on every add. */}
            <CartItems
              items={cartData?.cart?.items || []}
              onIncrease={increaseItem}
              onDecrease={decreaseItem}
              onRemove={(item) => {
                removeCartItem(item);
                if (selectedRowRef.current?.id === item.id) selectedRowRef.current = null;
              }}
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
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#16A34A] mt-10" />
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* [4] BOTTOM ROW: totals · customer · payment */}
      <section
        ref={paymentSummaryRef}
        className="shrink-0 grid grid-cols-1 lg:grid-cols-3 gap-3 max-h-[42vh] overflow-y-auto lg:max-h-none lg:overflow-visible"
        id="payment-scroll-container"
      >
        {/* Card A — Totals */}
        <Card className="p-4 min-w-0 flex flex-col justify-center">
          <CartSummary
            total={cartData?.summary?.total || 0}
            tax={cartData?.summary?.tax || 0}
            grandTotal={grandTotal}
          />
        </Card>
        {/* Card B — Customer + discount */}
        <Card className="p-4 min-w-0">
          <div className="flex flex-col gap-3 h-full">
            <div className="text-sm font-bold text-[#1E293B]">Customer</div>
            <CustomerSelect
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              displayName={billName}
              onAddNew={(phone) => { setNewCustomerPhone(phone || ""); setShowCustomerModal(true); }}
            />
            <DiscountSection
              discount={discount}
              subtotal={cartData?.summary?.total || cartData?.cart?.summary?.total || 0}
              onApplyDiscount={(amount) => {
                setDiscount(amount);
                applyDiscount(cartUUID, amount);
              }}
            />
          </div>
        </Card>
        {/* Card C — Payment method */}
        <Card className="p-4 min-w-0">
          <PaymentSection
            payments={payments}
            onPaymentChange={(index, field, value) => {
              // Functional update: pay_later fires method+amount back to
              // back, and a stale closure would let the second write wipe
              // the first (method silently reverting to cash).
              setPayments((prev) => {
                const updated = [...prev];
                updated[index] = { ...updated[index], [field]: value };
                return updated;
              });

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
        </Card>
      </section>
      {/* [5] FOOTER ACTION ROW */}
      <div className="shrink-0 flex items-center gap-3">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("pos-new-bill-request"))}
          title="Clear the bill (asks to confirm when items exist)"
          className="w-[210px] h-[52px] shrink-0 bg-white border border-[#D5DBE5] rounded-lg text-sm font-semibold text-[#1E293B] hover:border-red-400 hover:text-red-600 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-[18px] h-[18px]" />
          <span>Clear</span>
          <ShortcutBadge label="Ctrl+Shift+Enter" />
        </button>
        <button
          className="flex-1 h-[52px] bg-[#16A34A] hover:bg-[#15803D] text-white rounded-lg font-bold text-base transition-colors disabled:bg-[#86D6A4] disabled:cursor-not-allowed flex items-center justify-center gap-2"
          onClick={handleReview}
          disabled={cartLoading || !cartData?.cart?.items?.length || isCartInitializing}
        >
          {cartLoading ? (
            "Processing..."
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              <span>Submit Sale</span>
              <ShortcutBadge label="Ctrl+Enter" />
            </>
          )}
        </button>
        {selectedCustomer?.credit_balance > 0 && (
          <button
            className="px-3 h-[52px] shrink-0 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            onClick={() => {
              setPayments([
                { method: "cash", amount: selectedCustomer.credit_balance },
              ]);
            }}
          >
            Clear Old Due ₹{selectedCustomer.credit_balance}
          </button>
        )}
        <button
          className="h-[52px] px-4 shrink-0 bg-white border border-[#D5DBE5] rounded-lg text-sm font-semibold text-[#1E293B] hover:border-[#16A34A] transition-colors flex items-center gap-2"
          onClick={() => {
            loadSales();
            setShowSalesModal(true);
          }}
        >
          <ReceiptText className="w-[18px] h-[18px] text-[#64748B]" />
          <span>View Bill</span>
          <ShortcutBadge label="F5" />
        </button>
      </div>
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

      {showInventoryModal && (
        <InventoryModal onClose={() => setShowInventoryModal(false)} />
      )}

      {showInvoiceModal && invoiceData && (
        <InvoiceReceipt
          invoice={invoiceData}
          onClose={handleCloseInvoice}
          autoPrint={autoPrint}
          isDraft={!invoiceSaved}
          onSave={handleCheckout}
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
            savingRef.current = false;
          }}
          onConfirm={handlePrescriptionSubmit}
        />
      )}
    </div>
  );
}

export default POSpage;