// purchaseApi.ts
import { apiGet, apiPost, apiPut } from "./api";

export async function createPurchase(data: any) {
  console.log("🔵 createPurchase - Starting...");
  console.log("🔵 createPurchase - Payload:", JSON.stringify(data, null, 2));
  
  try {
    const response = await apiPost("/purchases", data);
    console.log("🟢 createPurchase - Success! Response:", response);
    return response;
  } catch (error: any) {
    console.error("🔴 createPurchase - Failed:", error);
    console.error("🔴 Error message:", error.message);
    throw error;
  }
}

export async function updatePurchase(purchase_uuid: string, data: any) {
  const response = await apiPut(`/purchases/${purchase_uuid}`, data);
  return response;
}

export async function getPurchases() {
  console.log("🔵 getPurchases - Starting...");
  
  try {
    const response = await apiGet("/purchases");
    console.log("🟢 getPurchases - Response:", response);
    
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    if (response && response.success && Array.isArray(response.data)) {
      return response.data;
    }
    
    console.warn("⚠️ Unexpected response type, returning []");
    return [];
  } catch (error) {
    console.error("🔴 getPurchases - Failed:", error);
    return [];
  }
}