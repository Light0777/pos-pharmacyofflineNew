// renderer/services/cartApi.ts

import { apiPost, apiGet, apiPut, apiDelete } from "./api";

// ─── Create Cart ───────────────────────────────────────────────────────────────

export async function createCart() {
  const response = await apiPost("/carts", {});
  // Backend returns { success, message, data: { cart_uuid, ... } }
  return response.data || response;
}

// ─── Get Cart ──────────────────────────────────────────────────────────────────

export async function getCart(cart_uuid: string) {
  const response = await apiGet(`/carts/${cart_uuid}`);
  return response.data || response;
}

// ─── Add Item ──────────────────────────────────────────────────────────────────
//
// The pharmacy backend CartController.addItem requires:
//   product_uuid, unit_uuid, quantity
//
// unit_uuid identifies WHICH pack size is being sold (Strip/Box/Tablet).
// If the product has no units defined yet, pass the product's default unit
// string as a fallback — the backend stores it as nullable so null is safe,
// but the controller validates its presence and will return 400 without it.
//
// Call sites must supply unit_uuid. See useCart.ts for how it's resolved.

export async function addItem(
  cart_uuid: string,
  product_uuid: string,
  unit_uuid: string,
  quantity: number = 1,
  batch_uuid?: string
) {
  const response = await apiPost(`/carts/${cart_uuid}/items`, {
    product_uuid,
    unit_uuid,
    quantity,
    batch_uuid,
  });
  return response.data || response;
}

// ─── Update Item ───────────────────────────────────────────────────────────────
//
// Route: PUT /carts/:cart_uuid/items/:product_uuid/:unit_uuid
// Both product_uuid and unit_uuid are needed to identify the row because
// the same product can exist in the cart in different units (Strip vs Box).

export async function updateItem(
  cart_uuid: string,
  product_uuid: string,
  unit_uuid: string,
  data: {
    quantity?: number;
    price?: number;
    discount?: number;
    tax_percent?: number;
  }
) {
  const response = await apiPut(
    `/carts/${cart_uuid}/items/${product_uuid}/${unit_uuid}`,
    data
  );
  return response.data || response;
}

// ─── Remove Item ───────────────────────────────────────────────────────────────
//
// Route: DELETE /carts/:cart_uuid/items/:product_uuid/:unit_uuid

export async function removeItem(
  cart_uuid: string,
  product_uuid: string,
  unit_uuid: string
) {
  const response = await apiDelete(
    `/carts/${cart_uuid}/items/${product_uuid}/${unit_uuid}`
  );
  return response.data || response;
}

// ─── Apply Bill Discount ───────────────────────────────────────────────────────

export async function applyDiscount(cart_uuid: string, discount: number) {
  const response = await apiPost(`/carts/${cart_uuid}/discount`, { discount });
  return response.data || response;
}

// ─── Hold / Resume ─────────────────────────────────────────────────────────────

export async function holdCart(cart_uuid: string) {
  const response = await apiPost(`/carts/${cart_uuid}/hold`, {});
  return response.data || response;
}

export async function resumeCart(cart_uuid: string) {
  const response = await apiPost(`/carts/${cart_uuid}/resume`, {});
  return response.data || response;
}

// ─── Held Carts ────────────────────────────────────────────────────────────────

export async function getHeldCarts() {
  const response = await apiGet("/carts/held");
  if (response?.success && Array.isArray(response.data)) return response.data;
  return [];
}

// ─── Clear Cart ────────────────────────────────────────────────────────────────

export async function clearCart(cart_uuid: string) {
  const response = await apiPost(`/carts/${cart_uuid}/clear`, {});
  return response.data || response;
}

// ─── Checkout ──────────────────────────────────────────────────────────────────
//
// payments: [{ method: "cash"|"upi"|"card"|"pay_later", amount: number }]
// Returns full response so useCart can read response.success and response.invoice.

// In cartApi.ts, update the checkoutCart function to handle errors better
// In cartApi.ts, update the checkoutCart function:

export async function checkoutCart(
  cart_uuid: string,
  payments: { method: string; amount: number }[],
  customer_uuid: string | null,
  prescriptionInfo?: any
) {
  const payload: any = {
    payments,
    customer_uuid,
  };

  // Backend expects 'prescriptions' array, not 'prescription_data'
  if (prescriptionInfo) {
    // If it's a single prescription (for the whole cart)
    if (prescriptionInfo.prescription_number && prescriptionInfo.doctor_name) {
      // Create an array of prescriptions for each product in cart
      // This is a simplified approach - you might need to map to specific products
      payload.prescriptions = [
        {
          product_uuid: prescriptionInfo.product_uuid || null,
          prescription_number: prescriptionInfo.prescription_number,
          doctor_name: prescriptionInfo.doctor_name,
          doctor_license: prescriptionInfo.doctor_license,
          patient_name: prescriptionInfo.patient_name,
          patient_age: prescriptionInfo.patient_age,
          patient_gender: prescriptionInfo.patient_gender,
        }
      ];
    } else {
      // If it already has the correct format
      payload.prescriptions = Array.isArray(prescriptionInfo)
        ? prescriptionInfo
        : [prescriptionInfo];
    }
  }

  console.log("📤 Checkout payload:", JSON.stringify(payload, null, 2));
  const response = await apiPost(`/carts/${cart_uuid}/checkout`, payload);
  return response;
}

// ─── Custom Item ───────────────────────────────────────────────────────────────

export async function addCustomItem(
  cart_uuid: string,
  item: {
    name: string;
    price: number;
    gst_percent: number;
    quantity: number;
  }
) {
  try {
    const response = await apiPost(`/carts/${cart_uuid}/custom-item`, item);
    return response.data || response;
  } catch (error) {
    console.error('Add custom item failed:', error);
    return { success: false, error: 'Custom item feature not available' };
  }
}