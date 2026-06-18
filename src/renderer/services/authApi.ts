import { apiPost } from "./api";

export async function login(email: string, password: string) {
  const res = await apiPost("auth/login", { email, password });
  return res;
}

export async function forgotPassword(email: string) {
  return await apiPost("auth/forgot-password", { email });
}

export async function verifySecurityAnswer(email: string, answer: string) {
  return await apiPost("auth/verify-answer", { email, answer });
}

export async function resetPassword(token: string, newPassword: string) {
  return await apiPost("auth/reset-password", { token, newPassword });
}