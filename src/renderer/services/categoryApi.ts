import { apiGet, apiPost, apiPut, apiDelete } from "./api";

// ── Categories ─────────────────────────────────────────────────────────────

export async function getCategories() {
  try {
    const response = await apiGet("/categories");
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to load categories:", error);
    return [];
  }
}

export async function createCategory(data: {
  name: string;
  parent_uuid?: string;
  description?: string;
}) {
  const response = await apiPost("/categories", data);
  return response.data || response;
}

export async function updateCategory(uuid: string, data: {
  name?: string;
  parent_uuid?: string;
  description?: string;
}) {
  const response = await apiPut(`/categories/${uuid}`, data);
  return response.data || response;
}

export async function deleteCategory(uuid: string) {
  const response = await apiDelete(`/categories/${uuid}`);
  return response.data || response;
}

// ── Attributes ─────────────────────────────────────────────────────────────

export async function getAttributes() {
  try {
    const response = await apiGet("/attributes");
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to load attributes:", error);
    return [];
  }
}

export async function createAttribute(data: {
  name: string;
  display_name: string;
  data_type: string;
}) {
  const response = await apiPost("/attributes", data);
  return response.data || response;
}

export async function deleteAttribute(uuid: string) {
  const response = await apiDelete(`/attributes/${uuid}`);
  return response.data || response;
}

// ── Category Attributes ────────────────────────────────────────────────────

export async function getAllCategoryAttributes() {
  try {
    const response = await apiGet(`/category-attributes`);
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to load all category attributes:", error);
    return [];
  }
}

export async function getCategoryAttributes(category_uuid: string) {
  try {
    const response = await apiGet(`/category-attributes/${category_uuid}`);
    if (response?.success && Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  } catch (error) {
    console.error("Failed to load category attributes:", error);
    return [];
  }
}

export async function assignAttributeToCategory(data: {
  category_uuid: string;
  attribute_uuid: string;
  is_required?: boolean;
  sort_order?: number;
}) {
  const response = await apiPost("/category-attributes", data);
  return response.data || response;
}

export async function removeAttributeFromCategory(category_uuid: string, attribute_uuid: string) {
  const response = await apiDelete(`/category-attributes?category_uuid=${category_uuid}&attribute_uuid=${attribute_uuid}`);
  return response.data || response;
}