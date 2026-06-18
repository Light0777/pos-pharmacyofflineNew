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
import { useProducts } from "./hooks/useProducts";
import { useCustomers } from "./hooks/useCustomers";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Store01Icon,
} from "@hugeicons/core-free-icons";
import InvoiceReceipt from "./components/InvoiceReceipt";
import { getSettings } from "../../renderer/services/settingsApi";
import { getInvoice } from "../../renderer/services/saleApi";
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

  // REMOVED local prescription state - now coming from useCart

  // Refs for scrollable containers
  const productGridRef = useRef<HTMLDivElement>(null);
  const cartItemsRef = useRef<HTMLDivElement>(null);
  const paymentSummaryRef = useRef<HTMLDivElement>(null);
  const barcodeScannedRef = useRef(false);

  const { products, loading: productsLoading, page, totalPages, goToPage, refetch } = useProducts();
  const {
    cartUUID,
    cartData,
    addItem,
    increaseItem,
    decreaseItem,
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

  const {
    customers,
    selectedCustomer,
    setSelectedCustomer,
    createNewCustomer,
    loadSales,
    sales,
    refreshAllCustomerData,
  } = useCustomers();

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
      productGrid: productGridRef.current?.scrollTop || 0,
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
      selectedCustomer
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
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

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

  // Keyboard shortcut: Enter to checkout
  useEffect(() => {
    const handleCheckoutShortcut = (e: KeyboardEvent) => {
      if (showCustomerModal || showSalesModal || showInvoiceModal || showPastInvoiceModal) {
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (barcodeScannedRef.current) {
        return;
      }

      if (e.key === 'Enter') {
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
    cartLoading,
    isCartInitializing,
    cartData
  ]);

  // Save scroll positions on scroll
  useEffect(() => {
    const handleProductScroll = () => saveScrollPositions();
    const handleCartScroll = () => saveScrollPositions();
    const handlePaymentScroll = () => saveScrollPositions();

    const productElement = productGridRef.current;
    const cartElement = cartItemsRef.current;
    const paymentElement = paymentSummaryRef.current;

    if (productElement) {
      productElement.addEventListener('scroll', handleProductScroll);
    }
    if (cartElement) {
      cartElement.addEventListener('scroll', handleCartScroll);
    }
    if (paymentElement) {
      paymentElement.addEventListener('scroll', handlePaymentScroll);
    }

    return () => {
      if (productElement) {
        productElement.removeEventListener('scroll', handleProductScroll);
      }
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
          const { productGrid, cartItems, paymentSummary } = JSON.parse(savedPositions);

          if (productGridRef.current && productGrid > 0) {
            productGridRef.current.scrollTop = productGrid;
          }
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

  // F5 to refresh products
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        refetchRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isCartInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#141414]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-white">Initializing cart...</p>
        </div>
      </div>
    );
  }

  const handleCloseInvoice = () => {
    setShowInvoiceModal(false);
    setInvoiceData(null);
    setPayments([{ method: "cash", amount: 0 }]);
    setDiscount(0);
    setSelectedCustomer(null);
    refetch();
  };

  return (
    <div className="h-screen flex flex-col bg-[#141414] font-inter overflow-hidden">
      <TopBar
        onShowSales={() => {
          loadSales();
          setShowSalesModal(true);
        }}
      />

      <div className="flex flex-1 overflow-hidden gap-3 p-3 flex-col lg:flex-row">

        {/* COLUMN 1: PRODUCTS */}
        <div className="w-full lg:w-1/2 flex flex-col min-h-0">
          <div className="px-3 font-bold text-white text-start">
            Products
          </div>
          <div
            ref={productGridRef}
            className="flex-1 overflow-y-auto scrollbar-hide"
            id="product-scroll-container"
          >
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
        </div>

        {/* COLUMN 2: CART ITEMS */}
        <div className="w-full lg:w-1/4 flex flex-col bg-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="p-4 font-bold text-white text-start border-b border-gray-800 flex justify-between items-center">
            <span>Cart Items</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">
                {cartData?.cart?.items?.length || 0} items
              </span>
            </div>
          </div>

          <div className="m-3 p-3 bg-[#212121] rounded-xl flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-black p-2">
                <HugeiconsIcon icon={Store01Icon} className="text-2xl text-gray-300"  />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-base font-bold text-white">
                    {shopSettings?.shop_name || 'My Store'}
                  </div>
                  {shopSettings?.gstin && (
                    <div className="text-xs text-gray-400">GSTIN: {shopSettings.gstin}</div>
                  )}
                </div>
                <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <span>{shopSettings?.address || 'Set address in Settings'}</span>
                </div>
              </div>
            </div>
          </div>

          <div
            ref={cartItemsRef}
            className="flex-1 overflow-y-auto scrollbar-hide"
            id="cart-scroll-container"
          >
            {cartLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : (
              <CartItems
                items={cartData?.cart?.items || []}
                onIncrease={increaseItem}
                onDecrease={decreaseItem}
              />
            )}
          </div>

          {(cartData?.cart?.items?.length || 0) > 0 && (
            <button
              onClick={clearCart}
              className="mx-3 mb-3 py-2 text-sm text-red-400 hover:text-white hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all"
            >
              Clear All
            </button>
          )}
        </div>

        {/* COLUMN 3: PAYMENT SUMMARY */}
        <div className="w-full lg:w-1/4 flex flex-col bg-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="p-4 font-bold text-white text-start border-b border-gray-800 flex-shrink-0">
            Payment Summary
          </div>

          <div
            ref={paymentSummaryRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
            id="payment-scroll-container"
          >
            <CartSummary
              total={cartData?.summary?.total || 0}
              tax={cartData?.summary?.tax || 0}
              grandTotal={grandTotal}
            />

            <CustomerSelect
              customers={customers}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={setSelectedCustomer}
              onAddNew={(phone) => { setNewCustomerPhone(phone || ""); setShowCustomerModal(true); }}
            />

            <DiscountSection
              discount={discount}
              onDiscountChange={setDiscount}
              onApplyDiscount={() => applyDiscount(cartUUID, discount)}
            />

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

            <button
              className="w-full bg-green-600 text-white p-3 rounded-xl font-bold disabled:opacity-50 hover:bg-green-700 transition-colors"
              onClick={handleCheckout}
              disabled={cartLoading || !cartData?.cart?.items?.length || isCartInitializing}
            >
              {cartLoading ? "Processing..." : "Checkout"}
            </button>

            {selectedCustomer?.credit_balance > 0 && (
              <button
                className="w-full bg-orange-500 text-white p-2 rounded-xl text-sm hover:bg-orange-600 transition-colors"
                onClick={() => {
                  setPayments([
                    { method: "cash", amount: selectedCustomer.credit_balance },
                  ]);
                }}
              >
                Clear Old Due ₹{selectedCustomer.credit_balance}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
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
                setShowSalesModal(false);
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
            setShowSalesModal(false);
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