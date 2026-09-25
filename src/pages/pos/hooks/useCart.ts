// pages/pos/hooks/useCart.ts

import { useState, useEffect, useRef } from "react";
import {
  createCart,
  addItem,
  addCustomItem,
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
  // Live cart id: window listeners (pos-add-product) and other once-registered
  // callbacks can invoke cart operations through stale render closures that
  // still hold the PREVIOUS bill's UUID after checkout creates a fresh cart.
  // Reading the id through this ref always yields the current bill, so an add
  // can never be posted to an already-completed cart again.
  const cartUUIDRef = useRef<string | null>(null);
  cartUUIDRef.current = cartUUID;

  // Prescription modal state
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionProduct, setPrescriptionProduct] = useState<any>(null);
  const [pendingCheckout, setPendingCheckout] = useState<{
    paymentMethods: any[];
    customerUUID: string | null;
    selectedCustomer: any;
    remarks?: string;
    customerMobile?: string;
    customerName?: string;
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
    const uuid = cartUUIDRef.current;
    if (!uuid) return;
    try {
      const response = await getCart(uuid);
      // Never let an error payload overwrite live cart state (e.g. a late
      // response for a completed bill wiping the fresh empty bill).
      if ((response as any)?.success === false && !(response as any)?.data && !(response as any)?.cart) return;
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
    const uuid = cartUUIDRef.current;
    if (!uuid) return;
    try {
      await clearCart(uuid);
    } catch (e) {
      console.error("Error clearing cart:", e);
    }
    await createFreshCart();
  };

  // ─── Add custom (ad-hoc) item to cart ───────────────────────────────────────

  const addCustomItemToCart = async (input: {
    name: string;
    price: number;
    gst_percent: number;
    quantity: number;
  }): Promise<boolean> => {
    if (isCartInitializing) {
      alert("Cart is initializing, please wait a moment...");
      return false;
    }
    const uuid = cartUUIDRef.current;
    if (!uuid) {
      alert("Cart not initialized. Please restart the app.");
      return false;
    }

    setLoading(true);

    try {
      const res: any = await addCustomItem(uuid, input);
      if (res && res.success === false) throw new Error(res.error || "Failed to add custom item");
      await refreshCart();
      return true;
    } catch (error: any) {
      console.error("❌ Error adding custom item to cart:", error);
      alert(error.message || "Failed to add custom item");
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ─── Add item to cart ─────────────────────────────────────────────────────

  const addItemToCart = async (product: any, unitUuid?: string, quantity?: number, unitName?: string, batchUuid?: string) => {
    const uuid = cartUUIDRef.current;
    console.log("🟢 addItemToCart called for:", product?.name, "cart:", uuid?.slice(0, 8));

    if (isCartInitializing) {
      alert("Cart is initializing, please wait a moment...");
      return;
    }
    if (!uuid) {
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

      const result: any = await addItem(uuid, product.product_uuid, finalUnitUuid, finalQuantity, batchUuid);
      // apiPost resolves (never throws) on HTTP errors, so surface backend
      // rejections here — otherwise refreshCart would re-display the wrong
      // (completed) bill as a phantom row that vanishes a second later.
      if (result && result.success === false) {
        throw new Error(result.error || "Failed to add item");
      }

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
    const uuid = cartUUIDRef.current;
    if (!uuid) return;
    setLoading(true);
    try {
      const unitUuid = item.unit_uuid || (await resolveUnitUuid(item, unitCacheRef.current));
      await addItem(uuid, item.product_uuid, unitUuid, 1, item.batch_uuid ?? null);
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
    const uuid = cartUUIDRef.current;
    if (!uuid) return;
    setLoading(true);
    try {
      const unitUuid = item.unit_uuid || (await resolveUnitUuid(item, unitCacheRef.current));
      const newQty = item.quantity - 1;

      if (newQty <= 0) {
        await removeItem(uuid, item.product_uuid, unitUuid, item.batch_uuid ?? null);
      } else {
        await updateItem(uuid, item.product_uuid, unitUuid, {
          quantity: newQty,
          match_batch_uuid: item.batch_uuid ?? null,
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

  // ─── Remove a row outright (Delete key) ────────────────────────────────────

  const removeCartItem = async (item: any) => {
    const uuid = cartUUIDRef.current;
    if (!uuid) return;
    setLoading(true);
    try {
      const unitUuid = item.unit_uuid || (await resolveUnitUuid(item, unitCacheRef.current));
      await removeItem(uuid, item.product_uuid, unitUuid, item.batch_uuid ?? null);
      await refreshCart();
    } catch (error: any) {
      console.error("❌ Error removing item:", error);
      alert(error.message || "Failed to remove item");
    } finally {
      setLoading(false);
    }
  };

  // ─── Set absolute quantity (spreadsheet cell edit) ─────────────────────────

  const updateItemQuantity = async (item: any, quantity: number) => {
    const uuid = cartUUIDRef.current;
    if (!uuid) return;
    const qty = Math.floor(Number(quantity));
    if (!qty || qty < 1) return;
    setLoading(true);
    try {
      const unitUuid = item.unit_uuid || (await resolveUnitUuid(item, unitCacheRef.current));
      await updateItem(uuid, item.product_uuid, unitUuid, {
        quantity: qty,
        match_batch_uuid: item.batch_uuid ?? null,
      });
      await refreshCart();
    } catch (error: any) {
      console.error("❌ Error updating item quantity:", error);
      alert(error.message || "Failed to update quantity");
    } finally {
      setLoading(false);
    }
  };

  // ─── Update arbitrary item fields (spreadsheet cell edits) ─────────────────

  const updateCartItem = async (
    item: any,
    fields: { quantity?: number; price?: number; discount?: number; tax_percent?: number; free_quantity?: number; batch_uuid?: string | null; new_unit_uuid?: string },
    matchBatchUuid?: string | null
  ) => {
    const uuid = cartUUIDRef.current;
    if (!uuid) return;
    setLoading(true);
    try {
      const unitUuid = item.unit_uuid || (await resolveUnitUuid(item, unitCacheRef.current));
      await updateItem(uuid, item.product_uuid, unitUuid, {
        ...fields,
        match_batch_uuid: matchBatchUuid !== undefined ? matchBatchUuid : (item.batch_uuid ?? null),
      });
      await refreshCart();
    } catch (error: any) {
      console.error("❌ Error updating cart item:", error);
      alert(error.message || "Failed to update item");
    } finally {
      setLoading(false);
    }
  };

  // ─── Switch a row batch in place (no row move) ──────────────────────────────

  const changeItemBatch = async (item: any, batchUuid: string) => {
    if (!batchUuid || item.batch_uuid === batchUuid) return;
    await updateCartItem(item, { batch_uuid: batchUuid });
  };

  // ─── Switch a row unit in place (price adopts new default) ────────────────────

  const changeItemUnit = async (item: any, unitUuid: string) => {
    if (!unitUuid || unitUuid === item.unit_uuid) return;
    await updateCartItem(item, { new_unit_uuid: unitUuid });
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
    selectedCustomer: any,
    remarks?: string,
    customerMobile?: string,
    customerName?: string
  ): Promise<CheckoutResult | null> => {
    const uuid = cartUUIDRef.current;
    if (!uuid) {
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
      setPendingCheckout({ paymentMethods, customerUUID, selectedCustomer, remarks, customerMobile, customerName });
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
      const res = await checkoutCart(uuid, normalizedPayments, customerUUID, null, remarks, customerMobile, customerName);
      console.log("✅ Checkout response:", res);

      if (!res.success) {
        const errorMessage = res.error || res.message || "";
        console.log("🔴 Error message:", errorMessage);

        if (errorMessage.toLowerCase().includes('prescription')) {
          console.log("🔴 Prescription required from backend!");
          const backendItem = findPrescriptionProduct();

          if (backendItem) {
            console.log("🔴 Found prescription product:", backendItem.product?.name);
            setPendingCheckout({ paymentMethods, customerUUID, selectedCustomer, remarks, customerMobile, customerName });
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

    const uuid = cartUUIDRef.current;
    if (!uuid) {
      alert("Cart not initialized");
      if (prescriptionResolver) {
        prescriptionResolver(null);
        setPrescriptionResolver(null);
      }
      return null;
    }

    if (pendingCheckout) {
      const { paymentMethods, customerUUID, selectedCustomer, remarks, customerMobile, customerName } = pendingCheckout;
      setPendingCheckout(null);

      setLoading(true);
      try {
        const res = await checkoutCart(uuid, paymentMethods, customerUUID, prescriptionWithProduct, remarks, customerMobile, customerName);
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
    addCustomItem: addCustomItemToCart,
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