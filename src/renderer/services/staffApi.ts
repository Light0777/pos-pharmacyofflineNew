import { apiGet, apiPost, apiPut, apiDelete } from "./api";

export interface Staff {
  user_uuid: string;
  name: string;
  email: string;
  role: string;
  security_question?: string;
  created_at: string;
}

export async function getStaff(): Promise<Staff[]> {
  const res = await apiGet("/staff");
  return Array.isArray(res) ? res : res?.data ?? [];
}

export async function createStaff(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  security_question?: string;
  security_answer?: string;
}): Promise<Staff | { error: string }> {
  return await apiPost("/staff", data);
}

// ✏️ UPDATE
export async function updateStaff(
  uuid: string,
  data: Partial<Staff> & { password?: string; security_answer?: string }
): Promise<Staff | { error: string }> {
  return await apiPut(`/staff/${uuid}`, data);
}

// 🗑️ DELETE
export async function deleteStaff(uuid: string): Promise<void> {
  await apiDelete(`/staff/${uuid}`);
}

// 📊 SUMMARY
export async function getStaffSummary() {
  try {
    const res = await apiGet("/staff/summary");
    return res?.data || res;
  } catch (error) {
    console.error("Failed to load staff summary:", error);
    return null;
  }
}

// 👥 BY ROLE
export async function getStaffByRole(role: string) {
  try {
    const res = await apiGet(`/staff/role/${role}`);
    return Array.isArray(res) ? res : res?.data ?? [];
  } catch (error) {
    console.error("Failed to load staff by role:", error);
    return [];
  }
}