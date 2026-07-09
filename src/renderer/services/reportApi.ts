import { apiGet } from "./api";

export async function getDashboardReport() {
  try {
    const response: any = await apiGet("/reports/dashboard");
    // Backend returns the fields directly (no data wrapper) from ReportModel.getDashboard()
    const data = response?.data || response;
    return {
      today_sales: data.today_sales || 0,
      today_refunds: data.today_refunds || 0,
      today_net_sales: data.today_net_sales ?? (data.today_sales || 0),
      month_sales: data.month_sales || 0,
      month_refunds: data.month_refunds || 0,
      month_net_sales: data.month_net_sales ?? (data.month_sales || 0),
      total_sales: data.total_sales || 0,
      total_refunds: data.total_refunds || 0,
      total_net_sales: data.total_net_sales ?? (data.total_sales || 0),
      total_orders: data.total_orders || 0,
      low_stock: data.low_stock || [],
      recent_sales: data.recent_sales || [],
      recent_purchases: data.recent_purchases || [],
      top_products: data.top_products || [],
    };
  } catch (error) {
    console.error("Dashboard API error:", error);
    return {
      today_sales: 0,
      today_refunds: 0,
      today_net_sales: 0,
      month_sales: 0,
      month_refunds: 0,
      month_net_sales: 0,
      total_sales: 0,
      total_refunds: 0,
      total_net_sales: 0,
      total_orders: 0,
      low_stock: [],
      recent_sales: [],
      recent_purchases: [],
      top_products: [],
    };
  }
}

export async function getTopProducts(limit?: number) {
  try {
    const params = limit ? `?limit=${limit}` : '';
    const response: any = await apiGet(`/reports/top-products${params}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Top products API error:", error);
    return [];
  }
}

export async function getRecentPurchases(limit?: number) {
  try {
    const params = limit ? `?limit=${limit}` : '';
    const response: any = await apiGet(`/reports/recent-purchases${params}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Recent purchases API error:", error);
    return [];
  }
}

export async function getStockReport() {
  try {
    const response: any = await apiGet("/reports/stock");
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Stock report API error:", error);
    return [];
  }
}

export async function getProfitReport() {
  try {
    const response: any = await apiGet("/reports/profit");
    const data = response?.data || response;
    return {
      revenue: data.revenue || 0,
      refunds: data.refunds || 0,
      cost: data.cost || 0,
      profit: data.profit || 0,
    };
  } catch (error) {
    console.error("Profit API error:", error);
    return { revenue: 0, cost: 0, profit: 0 };
  }
}

export async function getSalesTrend(days = 7) {
  try {
    const response: any = await apiGet(`/reports/sales-trend?days=${days}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Sales trend API error:", error);
    return [];
  }
}

export async function getProfitTrend(days = 7) {
  try {
    const response: any = await apiGet(`/reports/profit-trend?days=${days}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Profit trend API error:", error);
    return [];
  }
}

export async function getSalesByPayment(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const query = params.toString() ? `?${params}` : "";
  try {
    const response: any = await apiGet(`/reports/sales-by-payment${query}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Sales by payment API error:", error);
    return [];
  }
}

export async function getDailySales(days?: number) {
  const query = days ? `?days=${days}` : "";
  try {
    const response: any = await apiGet(`/reports/daily-sales${query}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Daily sales API error:", error);
    return [];
  }
}

export async function getProductSalesReport(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const query = params.toString() ? `?${params}` : "";
  try {
    const response: any = await apiGet(`/reports/product-sales${query}`);
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Product sales API error:", error);
    return [];
  }
}

export async function getCustomerPurchaseReport() {
  try {
    const response: any = await apiGet("/reports/customer-purchases");
    if (response?.success && Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  } catch (error) {
    console.error("Customer purchases API error:", error);
    return [];
  }
}

export async function getDailyReport(date: string) {
  try {
    const response: any = await apiGet(`/reports/daily-report?date=${date}`);
    if (response?.success && response.data) return response.data;
    // Return empty structure so report.summary never throws
    return {
      date,
      shop: null,
      summary: { total_bills: 0, grand_total: 0, subtotal: 0, total_tax: 0 },
      payments: [],
      gst_slabs: [],
      top_products: [],
      bills: [],
    };
  } catch (error) {
    console.error("Daily report API error:", error);
    return null;
  }
}

export async function getGSTReport(month: string) {
  try {
    const response: any = await apiGet(`/reports/gst-report?month=${month}`);
    if (response?.success && response.data) return response.data;
    return null;
  } catch (error) {
    console.error("GST report API error:", error);
    return null;
  }
}

export async function getCustomerTrend(): Promise<Array<{ date: string; total: number }>> {
  try {
    const response: any = await apiGet("/reports/customer-trend");
    if (Array.isArray(response)) return response;
    if (response?.data && Array.isArray(response.data)) return response.data;
    return [];
  } catch (error) {
    console.error("Customer trend API error:", error);
    return [];
  }
}

export async function getGSTReportByRange(startDate: string, endDate: string) {
  try {
    const response: any = await apiGet(`/reports/gst-report-range?startDate=${startDate}&endDate=${endDate}`);
    if (response?.success && response.data) return response.data;
    return null;
  } catch (error) {
    console.error("GST report by range API error:", error);
    return null;
  }
}