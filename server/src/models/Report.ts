import db from '../database/connection';

export class ReportModel {
  // static getDailyReport(date: string) {
  //   throw new Error('Method not implemented.');
  // }
  // Dashboard summary
  static getDashboard() {
    const now = new Date();

    // Get today's date in local time (IST)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayStr = today.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    // Get month start date in local time
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Alternative: Use SQLite's date functions with localtime
    // Today's sales - using DATE() with localtime
    const todaySales = (db.prepare(`
        SELECT COALESCE(SUM(grand_total), 0) as total 
        FROM sales 
        WHERE DATE(created_at, 'localtime') = DATE('now', 'localtime')
    `).get() as any).total;

    // Today's refunds
    const todayRefunds = (db.prepare(`
        SELECT COALESCE(SUM(refund_amount), 0) as total 
        FROM medicine_returns 
        WHERE return_type = 'customer_return'
        AND DATE(created_at, 'localtime') = DATE('now', 'localtime')
    `).get() as any).total;

    // This month's sales - using DATE() with localtime
    const monthSales = (db.prepare(`
        SELECT COALESCE(SUM(grand_total), 0) as total 
        FROM sales 
        WHERE strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
    `).get() as any).total;

    // This month's refunds
    const monthRefunds = (db.prepare(`
        SELECT COALESCE(SUM(refund_amount), 0) as total 
        FROM medicine_returns 
        WHERE return_type = 'customer_return'
        AND strftime('%Y-%m', created_at, 'localtime') = strftime('%Y-%m', 'now', 'localtime')
    `).get() as any).total;

    // Alternative method using string comparison (more reliable)
    // Today's sales alternative method
    const todaySalesAlt = (db.prepare(`
        SELECT COALESCE(SUM(grand_total), 0) as total 
        FROM sales 
        WHERE created_at LIKE '${todayStr}%'
    `).get() as any).total;

    // Total sales (all time)
    const totalSales = (db.prepare(`
        SELECT COALESCE(SUM(grand_total), 0) as total 
        FROM sales
    `).get() as any).total;

    // Total refunds (all time)
    const totalRefunds = (db.prepare(`
        SELECT COALESCE(SUM(refund_amount), 0) as total 
        FROM medicine_returns 
        WHERE return_type = 'customer_return'
    `).get() as any).total;

    // Total orders (excluding fully refunded)
    const totalOrders = (db.prepare(`
        SELECT COUNT(*) as count 
        FROM sales
        WHERE status != 'refunded'
    `).get() as any).count;

    // Recent sales (last 100)
    const recentSales = db.prepare(`
        SELECT s.*, 
               c.name as customer_name,
               (SELECT COALESCE(SUM(refund_amount), 0) 
                FROM medicine_returns 
                WHERE sale_uuid = s.sale_uuid AND return_type = 'customer_return'
               ) as refund_total
        FROM sales s
        LEFT JOIN customers c ON s.customer_uuid = c.customer_uuid
        ORDER BY s.created_at DESC
        LIMIT 100
    `).all();

    // Low stock products (stock < 10)
    const lowStock = db.prepare(`
        SELECT * FROM products 
        WHERE stock < 10
        ORDER BY stock ASC
    `).all();

    // Top 5 products by quantity sold
    const topProducts = db.prepare(`
        SELECT 
            p.name,
            p.product_uuid,
            SUM(si.quantity) as total_qty
        FROM sale_items si
        JOIN sales s ON si.sale_uuid = s.sale_uuid
        LEFT JOIN products p ON si.product_uuid = p.product_uuid
        GROUP BY si.product_uuid
        ORDER BY total_qty DESC
        LIMIT 5
    `).all();

    // Recent purchases (last 5)
    const recentPurchases = db.prepare(`
        SELECT p.*, s.name as supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_uuid = s.supplier_uuid
        ORDER BY p.created_at DESC
        LIMIT 5
    `).all();

    console.log('Debug - Dashboard calculations:', {
      todayStr,
      todaySales,
      monthStartStr,
      monthSales,
      totalSales
    });

    return {
      today_sales: todaySales || 0,
      today_refunds: todayRefunds || 0,
      today_net_sales: (todaySales || 0) - (todayRefunds || 0),
      month_sales: monthSales || 0,
      month_refunds: monthRefunds || 0,
      month_net_sales: (monthSales || 0) - (monthRefunds || 0),
      total_sales: totalSales || 0,
      total_refunds: totalRefunds || 0,
      total_net_sales: (totalSales || 0) - (totalRefunds || 0),
      total_orders: totalOrders || 0,
      recent_sales: recentSales,
      low_stock: lowStock,
      top_products: topProducts.map((p: any) => ({
        name: p.name || 'Unknown',
        total_qty: p.total_qty
      })),
      recent_purchases: recentPurchases
    };
  }

  // Top products report
  static getTopProducts() {
    const topProducts = db.prepare(`
      SELECT 
        p.product_uuid,
        p.name,
        p.manufacturer,
        p.barcode,
        p.sku,
        p.price,
        p.stock,
        SUM(si.quantity) as total_qty,
        SUM(si.price * si.quantity) as total_revenue,
        COALESCE(SUM(si.quantity * COALESCE(pb.ptr, 0)), 0) as total_cost
      FROM sale_items si
      JOIN sales s ON si.sale_uuid = s.sale_uuid
      LEFT JOIN products p ON si.product_uuid = p.product_uuid
      LEFT JOIN product_batches pb ON si.batch_uuid = pb.batch_uuid
      GROUP BY si.product_uuid
      ORDER BY total_qty DESC
      LIMIT 5
    `).all();

    return topProducts.map((item: any) => ({
      product_uuid: item.product_uuid,
      name: item.name || 'Unknown',
      manufacturerName: item.manufacturer,
      barcode: item.barcode,
      sku: item.sku,
      price: item.price,
      stock: item.stock,
      total_qty: item.total_qty,
      total_revenue: Math.round(item.total_revenue * 100) / 100,
      total_cost: Math.round(item.total_cost * 100) / 100,
      total_profit: Math.round((item.total_revenue - item.total_cost) * 100) / 100
    }));
  }

  // Stock report
  static getStockReport() {
    return db.prepare(`
      SELECT name, stock, price 
      FROM products
      ORDER BY name ASC
    `).all();
  }

  // Profit estimation
  static getProfit() {
    // Calculate total revenue from sales (using grand_total = subtotal + tax)
    const revenue = (db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as total
      FROM sales
    `).get() as any).total;

    // Total refund amount
    const totalRefunds = (db.prepare(`
      SELECT COALESCE(SUM(refund_amount), 0) as total
      FROM medicine_returns
      WHERE return_type = 'customer_return'
    `).get() as any).total;

    // Calculate COGS from sale items × batch PTR
    const cost = (db.prepare(`
      SELECT COALESCE(SUM(si.quantity * COALESCE(pb.ptr, 0)), 0) as total
      FROM sale_items si
      LEFT JOIN product_batches pb ON si.batch_uuid = pb.batch_uuid
    `).get() as any).total;

    const revenueNum = Number(revenue) || 0;
    const refundsNum = Number(totalRefunds) || 0;
    const costNum = Number(cost) || 0;
    const netRevenue = revenueNum - refundsNum;

    return {
      revenue: Math.round(netRevenue * 100) / 100,
      refunds: Math.round(refundsNum * 100) / 100,
      cost: Math.round(costNum * 100) / 100,
      profit: Math.round((netRevenue - costNum) * 100) / 100
    };
  }

  // Sales trend (last 7 days)
  static getSalesTrend() {
    const dates: string[] = [];
    const now = new Date();

    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Get sales data grouped by date
    const salesData = db.prepare(`
      SELECT 
        DATE(created_at, 'localtime') as date,
        SUM(grand_total) as total
      FROM sales
      WHERE created_at >= ?
      GROUP BY DATE(created_at, 'localtime')
      ORDER BY date ASC
    `).all(dates[0]) as Array<{ date: string; total: number }>;

    // Get refund data grouped by date
    const refundData = db.prepare(`
      SELECT 
        DATE(created_at, 'localtime') as date,
        COALESCE(SUM(refund_amount), 0) as total
      FROM medicine_returns
      WHERE return_type = 'customer_return' AND created_at >= ?
      GROUP BY DATE(created_at, 'localtime')
      ORDER BY date ASC
    `).all(dates[0]) as Array<{ date: string; total: number }>;

    // Build refund map
    const refundMap = new Map(refundData.map((d: any) => [d.date, Number(d.total)]));

    // Map to all 7 days with 0 for missing days, subtracting refunds
    return dates.map(date => {
      const dayData = salesData.find((d: any) => d.date === date);
      const gross = dayData ? Number(dayData.total) : 0;
      const refunds = refundMap.get(date) || 0;
      return {
        date,
        total: Math.round((gross - refunds) * 100) / 100
      };
    });
  }

  // Profit trend (last 7 days)
  static getProfitTrend() {
    const dates: string[] = [];
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 6);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Get sales per day (using grand_total = subtotal + GST)
    const salesByDay = db.prepare(`
      SELECT 
        DATE(created_at, 'localtime') as date,
        COALESCE(SUM(grand_total), 0) as revenue
      FROM sales
      WHERE created_at >= ?
      GROUP BY DATE(created_at, 'localtime')
    `).all(startDateStr) as Array<{ date: string; revenue: number }>;

    // Get refunds per day
    const refundsByDay = db.prepare(`
      SELECT 
        DATE(created_at, 'localtime') as date,
        COALESCE(SUM(refund_amount), 0) as total
      FROM medicine_returns
      WHERE return_type = 'customer_return' AND created_at >= ?
      GROUP BY DATE(created_at, 'localtime')
    `).all(startDateStr) as Array<{ date: string; total: number }>;

    // Get COGS per day from sale items × batch PTR
    const purchasesByDay = db.prepare(`
      SELECT 
        DATE(s.created_at, 'localtime') as date,
        COALESCE(SUM(si.quantity * COALESCE(pb.ptr, 0)), 0) as cost
      FROM sale_items si
      JOIN sales s ON si.sale_uuid = s.sale_uuid
      LEFT JOIN product_batches pb ON si.batch_uuid = pb.batch_uuid
      WHERE s.created_at >= ?
      GROUP BY DATE(s.created_at, 'localtime')
    `).all(startDateStr) as Array<{ date: string; cost: number }>;

    // Create maps for quick lookup
    const salesMap = new Map(salesByDay.map((d: any) => [d.date, Number(d.revenue)]));
    const refundsMap = new Map(refundsByDay.map((d: any) => [d.date, Number(d.total)]));
    const purchasesMap = new Map(purchasesByDay.map((d: any) => [d.date, Number(d.cost)]));

    // Build result for all 7 days (net revenue = gross - refunds)
    return dates.map(date => {
      const grossRevenue = salesMap.get(date) || 0;
      const refunds = refundsMap.get(date) || 0;
      const revenue = grossRevenue - refunds;
      const cost = purchasesMap.get(date) || 0;

      return {
        date,
        revenue: Math.round(revenue * 100) / 100,
        refunds: Math.round(refunds * 100) / 100,
        cost: Math.round(cost * 100) / 100,
        profit: Math.round((revenue - cost) * 100) / 100
      };
    });
  }

  // Additional useful reports

  // Sales by payment method
  static getSalesByPaymentMethod(startDate?: string, endDate?: string) {
    let query = `
      SELECT 
        method,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE method != 'refund'
    `;
    const params: any[] = [];

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' GROUP BY method ORDER BY total DESC';

    return db.prepare(query).all(...params);
  }

  // Daily sales summary for date range
  static getDailySalesSummary(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();

    return db.prepare(`
      SELECT 
        DATE(created_at, 'localtime') as date,
        COUNT(*) as order_count,
        COALESCE(SUM(total), 0) as total,
        COALESCE(SUM(tax), 0) as tax,
        COALESCE(SUM(grand_total), 0) as grand_total
      FROM sales
      WHERE created_at >= ?
      GROUP BY DATE(created_at, 'localtime')
      ORDER BY date DESC
    `).all(startDateStr);
  }

  // Product sales report
  static getProductSalesReport(startDate?: string, endDate?: string) {
    let query = `
      SELECT 
        p.product_uuid,
        p.name,
        p.barcode,
        p.sku,
        COUNT(DISTINCT si.sale_uuid) as order_count,
        COALESCE(SUM(si.quantity), 0) as total_qty,
        COALESCE(SUM(si.price * si.quantity), 0) as total_revenue,
        COALESCE(SUM(si.tax_amount), 0) as total_tax,
        COALESCE(SUM(si.quantity * COALESCE(pb.ptr, 0)), 0) as total_cost
      FROM sale_items si
      JOIN sales s ON si.sale_uuid = s.sale_uuid
      JOIN products p ON si.product_uuid = p.product_uuid
      LEFT JOIN product_batches pb ON si.batch_uuid = pb.batch_uuid
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      query += ' AND s.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND s.created_at <= ?';
      params.push(endDate);
    }

    query += `
      GROUP BY si.product_uuid
      ORDER BY total_revenue DESC
    `;

    return db.prepare(query).all(...params);
  }

  // Customer purchase history
  static getCustomerPurchaseReport() {
    return db.prepare(`
      SELECT 
        c.customer_uuid,
        c.name,
        c.mobile,
        COUNT(s.sale_uuid) as purchase_count,
        COALESCE(SUM(s.grand_total), 0) as total_spent,
        c.credit_balance
      FROM customers c
      LEFT JOIN sales s ON c.customer_uuid = s.customer_uuid
      GROUP BY c.customer_uuid
      ORDER BY total_spent DESC
    `).all();
  }

  // Daily new customer registrations (last 7 days)
  static getCustomerTrend() {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    const customerData = db.prepare(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total
      FROM customers
      WHERE created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `).all(dates[0]) as Array<{ date: string; total: number }>;

    const dataMap = new Map(customerData.map((d: any) => [d.date, Number(d.total)]));

    return dates.map(date => ({
      date,
      total: dataMap.get(date) || 0,
    }));
  }

  // Add to ReportModel class
  static getDailyReport(date: string): any {
    const startDate = `${date} 00:00:00`;
    const endDate = `${date} 23:59:59`;

    // Shop details
    const shop = db.prepare(`
    SELECT shop_name as name, address, mobile, gstin FROM settings LIMIT 1
  `).get() as any || { name: 'My Store' };

    // Summary
    const summary = db.prepare(`
    SELECT
      COUNT(*) as total_bills,
      COALESCE(SUM(total), 0) as subtotal,
      COALESCE(SUM(tax), 0) as total_tax,
      COALESCE(SUM(grand_total), 0) as grand_total,
      COALESCE((SELECT SUM(refund_amount) FROM medicine_returns WHERE return_type = 'customer_return' AND created_at BETWEEN ? AND ?), 0) as total_refunds,
      COALESCE((SELECT SUM(si.quantity * COALESCE(pb.ptr, 0)) FROM sale_items si JOIN product_batches pb ON si.batch_uuid = pb.batch_uuid JOIN sales s2 ON si.sale_uuid = s2.sale_uuid WHERE s2.created_at BETWEEN ? AND ?), 0) as total_cost
    FROM sales
    WHERE created_at BETWEEN ? AND ?
  `).get(startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate) as any;

    // Payment breakdown
    const payments = db.prepare(`
    SELECT p.method, COALESCE(SUM(p.amount), 0) as total
    FROM payments p
    JOIN sales s ON p.sale_uuid = s.sale_uuid
    WHERE s.created_at BETWEEN ? AND ?
    GROUP BY p.method
  `).all(startDate, endDate) as Array<{ method: string; total: number }>;

    // GST slabs (tax collected per percentage)
    const gstSlabs = db.prepare(`
    SELECT
      si.gst_percent as tax_percent,
      COALESCE(SUM(si.total), 0) as taxable_amount,
      COALESCE(SUM(si.gst_amount), 0) as tax_collected
    FROM sale_items si
    JOIN sales s ON si.sale_uuid = s.sale_uuid
    WHERE s.created_at BETWEEN ? AND ? AND si.gst_percent > 0
    GROUP BY si.gst_percent
    ORDER BY si.gst_percent
  `).all(startDate, endDate) as Array<{
      tax_percent: number;
      taxable_amount: number;
      tax_collected: number;
    }>;

    // Top 5 products
    const topProducts = db.prepare(`
    SELECT
      p.name,
      SUM(si.quantity) as qty_sold,
      COALESCE(SUM(si.total), 0) as revenue,
      COALESCE(SUM(si.quantity * COALESCE(pb.ptr, 0)), 0) as cost
    FROM sale_items si
    JOIN sales s ON si.sale_uuid = s.sale_uuid
    JOIN products p ON si.product_uuid = p.product_uuid
    LEFT JOIN product_batches pb ON si.batch_uuid = pb.batch_uuid
    WHERE s.created_at BETWEEN ? AND ?
    GROUP BY si.product_uuid
    ORDER BY qty_sold DESC
    LIMIT 5
  `).all(startDate, endDate) as Array<{
      name: string;
      qty_sold: number;
      revenue: number;
      cost: number;
    }>;

    // List of bills
    const bills = db.prepare(`
    SELECT
      s.invoice_number,
      s.grand_total,
      s.created_at,
      c.name as customer_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_uuid = c.customer_uuid
    WHERE s.created_at BETWEEN ? AND ?
    ORDER BY s.created_at ASC
  `).all(startDate, endDate) as Array<{
      invoice_number: string;
      grand_total: number;
      created_at: string;
      customer_name: string | null;
    }>;

    return {
      date,
      shop,
      summary,
      payments,
      gst_slabs: gstSlabs,
      top_products: topProducts,
      bills
    };
  }
}
