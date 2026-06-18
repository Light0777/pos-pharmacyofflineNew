// pages/pos/hooks/useCart.ts

import { useState, useEffect, useRef } from "react";
import {
  createCart,
  addItem,
  getCart,
  updateItem,
  removeItem,
  applyDiscount as applyDiscountApi,
  checkoutCart,
  clearCart,
} from "../../../renderer/services/cartApi";
import { getProductUnits } from "../../../renderer/services/productApi";

// ─── Unit resolution ───────────────────────────────────────────────────────────

async function resolveUnitUuid(
  product: any,
  unitCache: Map<string, string>
): Promise<string> {
  if (unitCache.has(product.product_uuid)) {
    return unitCache.get(product.product_uuid)!;
  }

  if (product.unit_uuid) {
    unitCache.set(product.product_uuid, product.unit_uuid);
    return product.unit_uuid;
  }

  try {
    const units: any[] = await getProductUnits(product.product_uuid);
    if (units.length > 0) {
      const base = units.find((u) => u.is_base_unit) || units[0];
      unitCache.set(product.product_uuid, base.unit_uuid);
      return base.unit_uuid;
    }
  } catch (err) {
    console.warn("Could not fetch product units for", product.product_uuid, err);
  }

  const fallback = product.unit || "piece";
  unitCache.set(product.product_uuid, fallback);
  return fallback;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckoutResult {
  success: boolean;
  invoice?: any;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useCart() {
  const [cartUUID, setCartUUID] = useState<string | null>(null);
  const [cartData, setCartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isCartInitializing, setIsCartInitializing] = useState(true);
  const [discount, setDiscount] = useState(0);
  const [payments, setPayments] = useState([{ method: "cash", amount: 0 }]);
  const currentMethodRef = useRef("cash");

  // Prescription modal state
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionProduct, setPrescriptionProduct] = useState<any>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{
    paymentMethods: any[];
    customerUUID: string | null;
    selectedCustomer: any;
  } | null>(null);
  
  // Promise resolver for checkout
  const [prescriptionResolver, setPrescriptionResolver] = useState<((result: CheckoutResult | null) => void) | null>(null);

  // Memoised unit_uuid per product
  const unitCacheRef = useRef<Map<string, string>>(new Map());

  // ─── Normalise cart response shape ─────────────────────────────────────────

  const normalizeCartData = (data: any) => {
    if (data?.cart) return data;
    if (data?.data?.cart) return data.data;
    if (data?.items !== undefined || data?.summary !== undefined) {
      return { cart: data, summary: data.summary };
    }
    if (data?.success && data?.data) {
      if (data.data.cart) return data.data;
      return { cart: data.data, summary: data.data.summary };
    }
    return data;
  };

  // ─── Wait for backend ──────────────────────────────────────────────────────

  const waitForBackend = async (
    maxRetries = 15,
    delayMs = 2000
  ): Promise<boolean> => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await fetch("http://127.0.0.1:3000/health");
        if (res.ok) return true;
      } catch {
        // not ready yet
      }
      console.log(`⏳ Waiting for backend... attempt ${i + 1}/${maxRetries}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  };

  // ─── Initialise cart ───────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      console.log("🟢 Initializing cart...");
      setIsCartInitializing(true);

      const backendReady = await waitForBackend();
      if (!backendReady) {
        alert("Backend not responding. Please restart the app.");
        setIsCartInitializing(false);
        return;
      }

      try {
        const res = await createCart();
        console.log("🟢 Create cart response:", res);
        const cartUuid = res?.cart_uuid || res?.data?.cart_uuid;
        if (!cartUuid) throw new Error("No cart_uuid in response");

        setCartUUID(cartUuid);
        const cartResponse = await getCart(cartUuid);
        console.log("🟢 Get cart response:", cartResponse);
        setCartData(normalizeCartData(cartResponse));
      } catch (error) {
        console.error("❌ Failed to create cart:", error);
        alert("Failed to initialize cart. Please restart the app.");
      } finally {
        setIsCartInitializing(false);
      }
    }
    init();
  }, []);

  // ─── Refresh cart ─────────────────────────────────────────────────────────

  const refreshCart = async () => {
    if (!cartUUID) return;
    try {
      const response = await getCart(cartUUID);
      setCartData(normalizeCartData(response));
    } catch (error) {
      console.error("❌ Error refreshing cart:", error);
    }
  };

  // ─── Fresh cart ────────────────────────────────────────────────────────────

  const createFreshCart = async () => {
    unitCacheRef.current.clear();

    const newCart = await createCart();
    const newCartUuid = newCart.cart_uuid || newCart.data?.cart_uuid;
    setCartUUID(newCartUuid);
    if (newCartUuid) {
      const newCartData = await getCart(newCartUuid);
      setCartData(normalizeCartData(newCartData));
    }
    setPayments([{ method: currentMethodRef.current, amount: 0 }]);
    setDiscount(0);
    return newCartUuid;
  };

  // ─── Clear cart ───────────────────────────────────────────────────────────

  const clearCartHandler = async () => {
    if (!cartUUID) return;
    try {
      await clearCart(cartUUID);
    } catch (e) {
      console.error("Error clearing cart:", e);
    }
    await createFreshCart();
  };

  // ─── Add item to cart ─────────────────────────────────────────────────────

  const addItemToCart = async (product: any, unitUuid?: string, quantity?: number, unitName?: string, batchUuid?: string) => {
    console.log("🟢 addItemToCart called for:", product?.name);

    if (isCartInitializing) {
      alert("Cart is initializing, please wait a moment...");
      return;
    }
    if (!cartUUID) {
      alert("Cart not initialized. Please restart the app.");
      return;
    }

    setLoading(true);

    try {
      let finalUnitUuid = unitUuid;
      if (!finalUnitUuid) {
        finalUnitUuid = await resolveUnitUuid(product, unitCacheRef.current);
      }

      const finalQuantity = quantity || 1;

      const result = await addItem(cartUUID, product.product_uuid, finalUnitUuid, finalQuantity, batchUuid);

      await refreshCart();
      console.log("🟢 Cart refreshed successfully");

    } catch (error: any) {
      console.error("❌ Error adding item to cart:", error);
      alert(`Failed to add item: ${error.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── Increase quantity ─────────────────────────────────────────────────────

  const increaseItem = async (item: any) => {
    if (!cartUUID) return;
    setLoading(true);
    try {
      const unitUuid = item.unit_uuid || (await resolveUnitUuid(item, unitCacheRef.current));
      await addItem(cartUUID, item.product_uuid, unitUuid, 1);
      await refreshCart();
    } catch (error: any) {
      console.error("❌ Error increasing item:", error);
      alert(error.message || "Failed to increase quantity");
    } finally {
      setLoading(false);
    }
  };

  // ─── Decrease quantity ─────────────────────────────────────────────────────

  const decreaseItem = async (item: any) => {
    if (!cartUUID) return;
    setLoading(true);
    try {
      const unitUuid = item.unit_uuid || (await resolveUnitUuid(item, unitCacheRef.current));
      const newQty = item.quantity - 1;

      if (newQty <= 0) {
        await removeItem(cartUUID, item.product_uuid, unitUuid);
      } else {
        await updateItem(cartUUID, item.product_uuid, unitUuid, {
          quantity: newQty,
        });
      }
      await refreshCart();
    } catch (error: any) {
      console.error("❌ Error decreasing item:", error);
      alert(error.message || "Failed to decrease quantity");
    } finally {
      setLoading(false);
    }
  };

  // ─── Apply discount ────────────────────────────────────────────────────────

  const applyDiscount = async (uuid: string | null, amount: number) => {
    if (!uuid) return;
    try {
      await applyDiscountApi(uuid, amount);
      await refreshCart();
    } catch (error) {
      console.error("❌ Error applying discount:", error);
    }
  };

  // ─── Find product requiring prescription ───────────────────────────────────

  const findPrescriptionProduct = () => {
    const cartItems = getCartItems();
    return cartItems.find((item: any) =>
      item.product?.prescription_required ||
      (item.product?.schedule_type && item.product.schedule_type !== 'NONE')
    );
  };

  // ─── Checkout with prescription handling ───────────────────────────────────

  const checkout = async (
    paymentMethods: any[],
    customerUUID: string | null,
    selectedCustomer: any
  ): Promise<CheckoutResult | null> => {
    if (!cartUUID) {
      alert("Cart not initialized");
      return null;
    }

    const cartStatus = cartData?.status || cartData?.cart?.status;
    if (cartStatus === "completed") {
      await createFreshCart();
      alert("New cart created. Please add items again.");
      return null;
    }

    const cartItems = getCartItems();
    if (cartItems.length === 0) {
      alert("No items in cart");
      return null;
    }

    const grandTotal = Number(
      cartData?.summary?.grand_total ||
      cartData?.cart?.summary?.grand_total ||
      0
    );

    const normalizedPayments = paymentMethods.map((p) => ({
      method: String(p.method),
      amount: grandTotal,
    }));

    const totalPaidAmount = normalizedPayments.reduce(
      (sum, p) => sum + p.amount,
      0
    );
    const isCreditPayment = normalizedPayments.some(
      (p) => p.method === "pay_later"
    );

    if (
      totalPaidAmount < grandTotal &&
      !isCreditPayment &&
      !customerUUID
    ) {
      alert(
        `Please enter full payment of ₹${grandTotal} or select a customer for credit.`
      );
      return null;
    }

    // Proactively check for prescription-required items before calling the backend
    const prescriptionItem = findPrescriptionProduct();
    if (prescriptionItem) {
      console.log("🔴 Prescription required detected for:", prescriptionItem.product?.name);
      setPendingCheckout({ paymentMethods, customerUUID, selectedCustomer });
      setPrescriptionProduct({
        name: prescriptionItem.product?.name,
        schedule_type: prescriptionItem.product?.schedule_type,
        product_uuid: prescriptionItem.product_uuid
      });
      setShowPrescriptionModal(true);
      setLoading(false);

      return new Promise<CheckoutResult | null>((resolve) => {
        setPrescriptionResolver(() => resolve);
      });
    }

    setLoading(true);
    try {
      const res = await checkoutCart(cartUUID, normalizedPayments, customerUUID, null);
      console.log("✅ Checkout response:", res);

      if (!res.success) {
        const errorMessage = res.error || res.message || "";
        console.log("🔴 Error message:", errorMessage);

        if (errorMessage.toLowerCase().includes('prescription')) {
          console.log("🔴 Prescription required from backend!");
          const backendItem = findPrescriptionProduct();

          if (backendItem) {
            console.log("🔴 Found prescription product:", backendItem.product?.name);
            setPendingCheckout({ paymentMethods, customerUUID, selectedCustomer });
            setPrescriptionProduct({
              name: backendItem.product?.name,
              schedule_type: backendItem.product?.schedule_type,
              product_uuid: backendItem.product_uuid
            });
            setShowPrescriptionModal(true);
            setLoading(false);

            return new Promise<CheckoutResult | null>((resolve) => {
              setPrescriptionResolver(() => resolve);
            });
          }
        }
        throw new Error(errorMessage || "Checkout failed");
      }

      const invoice = res.invoice || res.data?.invoice;
      await createFreshCart();
      return { success: true, invoice };
    } catch (err: any) {
      console.error("❌ Checkout failed:", err);
      alert(err.message || "Checkout failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  // ─── Handle prescription submission ────────────────────────────────────────

  const handlePrescriptionSubmit = async (prescriptionInfo: any) => {
    console.log("📝 Prescription submitted:", prescriptionInfo);
    setShowPrescriptionModal(false);
    
    const prescriptionWithProduct = {
      ...prescriptionInfo,
      product_uuid: prescriptionProduct?.product_uuid,
    };
    
    const currentPrescriptionProduct = prescriptionProduct;
    setPrescriptionProduct(null);
    
    if (!cartUUID) {
      alert("Cart not initialized");
      if (prescriptionResolver) {
        prescriptionResolver(null);
        setPrescriptionResolver(null);
      }
      return null;
    }
    
    if (pendingCheckout) {
      const { paymentMethods, customerUUID, selectedCustomer } = pendingCheckout;
      setPendingCheckout(null);
      
      setLoading(true);
      try {
        const res = await checkoutCart(cartUUID, paymentMethods, customerUUID, prescriptionWithProduct);
        console.log("✅ Checkout with prescription response:", res);
        
        let result: CheckoutResult | null = null;
        if (!res.success) {
          throw new Error(res.error || res.message || "Checkout failed");
        }
        
        const invoice = res.invoice || res.data?.invoice;
        await createFreshCart();
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('refresh-dashboard'));
          window.dispatchEvent(new Event('refresh-customers'));
        }
        
        result = { success: true, invoice };
        
        // Resolve the promise that checkout is waiting on
        if (prescriptionResolver) {
          prescriptionResolver(result);
          setPrescriptionResolver(null);
        }
        
        return result;
      } catch (err: any) {
        console.error("❌ Checkout with prescription failed:", err);
        alert(err.message || "Checkout failed");
        if (prescriptionResolver) {
          prescriptionResolver(null);
          setPrescriptionResolver(null);
        }
        return null;
      } finally {
        setLoading(false);
      }
    }
    return null;
  };

  // ─── Selectors ─────────────────────────────────────────────────────────────

  const getCartItems = () => cartData?.cart?.items || cartData?.items || [];
  const getCartSummary = () =>
    cartData?.summary ||
    cartData?.cart?.summary || {
      total: 0,
      tax: 0,
      grand_total: 0,
    };

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const grandTotal = Number(getCartSummary().grand_total || 0);
  const balance = totalPaid - grandTotal;

  return {
    cartUUID,
    cartData,
    loading,
    isCartInitializing,
    discount,
    setDiscount,
    payments,
    setPayments,
    totalPaid,
    grandTotal,
    balance,
    addItem: addItemToCart,
    increaseItem,
    decreaseItem,
    applyDiscount,
    checkout,
    refreshCart,
    clearCart: clearCartHandler,
    getCartItems,
    getCartSummary,
    currentMethodRef,
    // Prescription modal props
    showPrescriptionModal,
    prescriptionProduct,
    handlePrescriptionSubmit,
    setShowPrescriptionModal,
    setPrescriptionProduct,
  };
}