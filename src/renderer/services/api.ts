// api.ts
const BASE_URL = "http://127.0.0.1:3000/api";

let onUnauthorized: (() => void) | null = null;

export function setOnUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

function getToken() {
  return localStorage.getItem("token");
}

function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// 🔥 CENTRALIZED HANDLER
async function handleResponse(res: Response, url: string) {
  console.log(`📥 API Response [${res.status}] for ${url}`);
  
  if (res.status === 401 && !res.url.includes('/auth/login')) {
    console.log("🔴 Unauthorized — clearing auth");
    onUnauthorized?.();
    return { success: false, error: 'Unauthorized', status: 401 };
  }

  const data = await res.json();
  console.log(`📥 Response data:`, data);

  // For errors, return the error data instead of throwing
  // This allows the caller to check the error message
  if (!res.ok) {
    return { success: false, error: data?.error || data?.message || `HTTP ${res.status}` };
  }

  return data;
}

export async function apiGet(url: string) {
  console.log(`📤 GET ${url}`);
  const res = await fetch(BASE_URL + url, {
    headers: getHeaders(),
  });
  return handleResponse(res, url);
}

export async function apiPost(url: string, data: any) {
  console.log(`📤 POST ${url}`);
  console.log(`📦 Request body:`, JSON.stringify(data, null, 2));
  
  const res = await fetch(BASE_URL + url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  return handleResponse(res, url);
}

// PUT ✅ Fixed
export async function apiPut(url: string, data: any) {
  console.log(`📤 PUT ${url}`);
  console.log(`📦 Request body:`, JSON.stringify(data, null, 2));
  
  const res = await fetch(BASE_URL + url, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  
  return handleResponse(res, url);
}

// DELETE ✅ Fixed
export async function apiDelete(url: string) {
  console.log(`📤 DELETE ${url}`);
  
  const res = await fetch(BASE_URL + url, {
    method: "DELETE",
    headers: getHeaders(),
  });
  
  return handleResponse(res, url);
}