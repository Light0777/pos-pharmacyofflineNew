// productApi.ts
import { apiGet, apiPost, apiPut, apiDelete } from "./api";

export async function getProducts(page = 1, limit = 20) {
  try {
    const response = await apiGet(`/products?page=${page}&limit=${limit}`);
    console.log("📦 Products API response:", response);

    // New backend returns { success, products, total }
    if (response && response.success && Array.isArray(response.products)) {
      return { products: response.products, total: response.total ?? 0 };
    }
    // Old fallback: { success, data: [...] }
    if (response && response.success && Array.isArray(response.data)) {
      return { products: response.data, total: response.total ?? 0 };
    }
    if (Array.isArray(response)) {
      return { products: response, total: response.length };
    }

    console.warn("Unexpected products response structure", response);
    return { products: [], total: 0 };
  } catch (error) {
    console.error("Failed to load products:", error);
    return { products: [], total: 0 };
  }
}

export async function createProduct(data: any) {
  const response = await apiPost("/products", data);
  return response.data || response;
}

export async function updateProduct(uuid: string, data: any) {
  const response = await apiPut(`/products/${uuid}`, data);
  return response.data || response;
}

export async function deleteProduct(uuid: string) {
  const response = await apiDelete(`/products/${uuid}`);
  return response.data || response;
}

export async function searchProducts(q: string) {
  const response = await apiGet(`/products/search?q=${encodeURIComponent(q)}`);
  if (response && response.success && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

export async function getLowStockProducts(threshold = 10) {
  const response = await apiGet(`/products/low-stock?threshold=${threshold}`);
  if (response && response.success && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

// ── Product Units ──────────────────────────────────────────────────────────

export async function getProductUnits(product_uuid: string) {
  const response = await apiGet(`/product-units/product/${product_uuid}`);
  if (response && response.success && Array.isArray(response.data)) {
    return response.data;
  }
  return [];
}

export async function createProductUnit(data: {
  product_uuid: string;
  unit_name: string;
  conversion_factor: number;
  barcode?: string;
  price?: number;
  purchase_price?: number;
  is_base_unit?: boolean;
}) {
  const response = await apiPost("/product-units", data);
  return response.data || response;
}

export async function deleteProductUnit(unit_uuid: string) {
  const response = await apiDelete(`/product-units/${unit_uuid}`);
  return response.data || response;
}

// ── Product Batches ─────────────────────────────────────────────────────────

export async function getProductBatches(product_uuid: string) {
  try {
    const response = await apiGet(`/product-batches/product/${product_uuid}`);
    // Handle different response formats
    if (response && response.success && Array.isArray(response.data)) {
      return response.data;
    }
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  } catch (error) {
    console.error("Failed to load product batches:", error);
    return [];
  }
}

export async function getAvailableBatches(product_uuid: string) {
  try {
    const response = await apiGet(`/product-batches/available/${product_uuid}`);
    if (response && response.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to load available batches:", error);
    return [];
  }
}

export async function getNearExpiryBatches() {
  try {
    const response = await apiGet(`/product-batches/near-expiry`);
    if (response && response.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to load near expiry batches:", error);
    return [];
  }
}

export async function updateProductBatch(batch_uuid: string, data: any) {
  const response = await apiPut(`/product-batches/${batch_uuid}`, data);
  return response.data || response;
}

export async function deleteBatch(batch_uuid: string) {
  const response = await apiDelete(`/product-batches/${batch_uuid}`);
  return response.data || response;
}

// ── Single Product ───────────────────────────────────────────────────────────

export async function getProduct(uuid: string) {
  try {
    const response = await apiGet(`/products/${uuid}`);
    if (response?.success && response.data) {
      return response.data;
    }
    return response?.data || response;
  } catch (error) {
    console.error("Failed to load product:", error);
    return null;
  }
}

// ── Product Batches ─────────────────────────────────────────────────────────

export async function createProductBatch(data: {
  product_uuid: string;
  batch_number: string;
  expiry_date: string;
  manufacture_date?: string;
  mrp?: number;
  ptr?: number;
  rate?: number;
  purchase_price?: number;
  selling_price?: number;
  gst_percent?: number;
  quantity: number;
  supplier_uuid?: string;
  strips?: number;
}) {
  const response = await apiPost("/product-batches", data);
  return response.data || response;
}

export async function consumeFefo(data: {
  product_uuid: string;
  quantity: number;
  unit_uuid?: string;
}) {
  try {
    const response = await apiPost("/product-batches/consume-fefo", data);
    return response.data || response;
  } catch (error) {
    console.error("FEFO consumption failed:", error);
    return { success: false, error: "FEFO consumption failed" };
  }
}

export async function searchBatches(q: string): Promise<{ batch_uuid: string; product_uuid: string; batch_number: string }[]> {
  try {
    const response = await apiGet(`/product-batches/search?q=${encodeURIComponent(q)}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    return [];
  } catch (error) {
    console.error("Failed to search batches:", error);
    return [];
  }
}

export async function quarantineExpiredBatches() {
  try {
    const response = await apiPost("/product-batches/quarantine-expired", {});
    return response.data || response;
  } catch (error) {
    console.error("Quarantine expired failed:", error);
    return { success: false, error: "Quarantine expired feature not available" };
  }
}

// ── Migration ───────────────────────────────────────────────────────────────

export async function previewMigration(fileContent: string, fileType: string) {
  try {
    const response = await apiPost('/migration/preview', { fileContent, fileType });
    return response.data || response;
  } catch (error) {
    console.error('Migration preview failed:', error);
    return [];
  }
}

export async function confirmMigration(products: any[], onDuplicate: 'skip' | 'overwrite') {
  try {
    const response = await apiPost('/migration/confirm', { products, onDuplicate });
    return response.data || response;
  } catch (error) {
    console.error('Migration confirm failed:', error);
    return { success: false, error: 'Migration endpoint not available' };
  }
}

// ── Product Templates ─────────────────────────────────────────────────────

export async function getProductTemplates() {
  try {
    const response = await apiGet("/product-templates");
    if (response?.success && Array.isArray(response.data)) return response.data;
    return [];
  } catch (error) {
    console.error("Failed to load product templates:", error);
    return [];
  }
}

export async function getProductTemplate(uuid: string) {
  try {
    const response = await apiGet(`/product-templates/${uuid}`);
    return response?.data || response;
  } catch (error) {
    console.error("Failed to load product template:", error);
    return null;
  }
}

export async function createProductTemplate(data: any) {
  const response = await apiPost("/product-templates", data);
  return response.data || response;
}

export async function updateProductTemplate(uuid: string, data: any) {
  const response = await apiPut(`/product-templates/${uuid}`, data);
  return response.data || response;
}

export async function deleteProductTemplate(uuid: string) {
  const response = await apiDelete(`/product-templates/${uuid}`);
  return response.data || response;
}