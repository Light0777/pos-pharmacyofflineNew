// src/renderer/services/profileApi.ts
import { apiGet } from "./api";

// Define the expected response types
export interface UserProfile {
  user_uuid?: string;
  name: string;
  email: string;
  role: string;
  security_question?: string | null;
  [key: string]: any;
}

export interface ShopProfile {
  id?: number;
  shop_name?: string;
  invoice_prefix?: string;
  mobile?: string;
  address?: string;
  gstin?: string;
  is_active?: boolean;
  expiry_date?: string;
  plan?: string;
  price?: number;
  [key: string]: any;
}

export interface ProfileResponse {
  data: {
    user: UserProfile;
    tenant: ShopProfile;
  };
}

export async function getProfile(): Promise<ProfileResponse> {
  try {
    const response = await apiGet("/auth/me");
    
    console.log("Profile API response:", response);
    
    // Handle different response structures from your API
    let userData: UserProfile = {
      name: "",
      email: "",
      role: ""
    };
    
    let shopData: ShopProfile = {};
    
    // Case 1: Response has user and shop directly
    if (response.user) {
      userData = response.user;
      shopData = response.shop || {};
    }
    // Case 2: Response has data wrapper
    else if (response.data) {
      userData = response.data.user || response.data;
      shopData = response.data.shop || response.data.tenant || {};
    }
    // Case 3: Response is the user object itself
    else if (response.name) {
      userData = response;
      shopData = {};
    }
    
    // Return in the format your component expects
    return {
      data: {
        user: userData,
        tenant: shopData
      }
    };
  } catch (error) {
    console.error("Get profile error:", error);
    throw error;
  }
}