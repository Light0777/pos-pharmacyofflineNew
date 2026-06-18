import type { Request, Response } from 'express';
import { ReportModel } from '../models/Report';
import type { AuthRequest } from '../middleware/auth';
import db from '../database/connection';

export class ReportController {
  // Dashboard summary
  static dashboard = (req: AuthRequest, res: Response): void => {
    try {
      const dashboard = ReportModel.getDashboard();
      res.json(dashboard);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Top products
  static topProducts = (req: AuthRequest, res: Response): void => {
    try {
      const products = ReportModel.getTopProducts();
      res.json(products);
    } catch (error) {
      console.error('Top products error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Stock report
  static stock = (req: AuthRequest, res: Response): void => {
    try {
      const stockReport = ReportModel.getStockReport();
      res.json(stockReport);
    } catch (error: any) {
      console.error('Stock report error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  };

  // Profit estimation
  static profit = (req: AuthRequest, res: Response): void => {
    try {
      const profitData = ReportModel.getProfit();
      res.json(profitData);
    } catch (error) {
      console.error('Profit report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Sales trend (last 7 days)
  static salesTrend = (req: AuthRequest, res: Response): void => {
    try {
      const trend = ReportModel.getSalesTrend();
      res.json(trend);
    } catch (error) {
      console.error('Sales trend error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Profit trend (last 7 days)
  static profitTrend = (req: AuthRequest, res: Response): void => {
    try {
      const trend = ReportModel.getProfitTrend();
      res.json(trend);
    } catch (error) {
      console.error('Profit trend error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Sales by payment method
  static salesByPayment = (req: AuthRequest, res: Response): void => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const data = ReportModel.getSalesByPaymentMethod(startDate, endDate);
      res.json(data);
    } catch (error) {
      console.error('Sales by payment error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Daily sales summary
  static dailySales = (req: AuthRequest, res: Response): void => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const summary = ReportModel.getDailySalesSummary(days);
      res.json(summary);
    } catch (error) {
      console.error('Daily sales error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Product sales report
  static productSales = (req: AuthRequest, res: Response): void => {
    try {
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const report = ReportModel.getProductSalesReport(startDate, endDate);
      res.json(report);
    } catch (error) {
      console.error('Product sales report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Customer trend (last 7 days)
  static customerTrend = (req: AuthRequest, res: Response): void => {
    try {
      const trend = ReportModel.getCustomerTrend();
      res.json(trend);
    } catch (error) {
      console.error('Customer trend error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Customer purchase report
  static customerPurchases = (req: AuthRequest, res: Response): void => {
    try {
      const report = ReportModel.getCustomerPurchaseReport();
      res.json(report);
    } catch (error) {
      console.error('Customer purchase report error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  static getGSTReport = (req: Request, res: Response): void => {
    try {
      const { month } = req.query; // format: YYYY-MM
      if (!month) {
        res.status(400).json({ success: false, error: 'Month parameter required (YYYY-MM)' });
        return;
      }

      const startDate = `${month}-01`;
      const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().slice(0, 10);

      // Get shop settings
      const shop = db.prepare('SELECT shop_name, gstin FROM settings LIMIT 1').get() as any;

      // Get GST slabs
      const slabs = db.prepare(`
      SELECT 
        gst_percent as tax_percent,
        COUNT(DISTINCT s.sale_uuid) as invoice_count,
        COALESCE(SUM(si.total), 0) as taxable_value,
        COALESCE(SUM(si.gst_amount), 0) as total_tax
      FROM sale_items si
      JOIN sales s ON s.sale_uuid = si.sale_uuid
      WHERE s.created_at BETWEEN ? AND ?
        AND si.gst_percent > 0
      GROUP BY si.gst_percent
      ORDER BY si.gst_percent
    `).all(startDate, endDate);

      // Exempt (0% GST) – items with gst_percent = 0
      const exempt = db.prepare(`
      SELECT COALESCE(SUM(si.total), 0) as exempt_value, COUNT(DISTINCT s.sale_uuid) as exempt_invoices
      FROM sale_items si
      JOIN sales s ON s.sale_uuid = si.sale_uuid
      WHERE s.created_at BETWEEN ? AND ?
        AND (si.gst_percent = 0 OR si.gst_percent IS NULL)
    `).get(startDate, endDate) as { exempt_value: number; exempt_invoices: number };

      // Invoices list for the month
      const invoices = db.prepare(`
      SELECT 
        s.sale_uuid,
        s.invoice_number,
        s.created_at,
        c.name as customer_name,
        s.total,
        s.tax,
        s.grand_total,
        (SELECT GROUP_CONCAT(DISTINCT si.gst_percent || '%') FROM sale_items si WHERE si.sale_uuid = s.sale_uuid AND si.gst_percent > 0) as gst_rates
      FROM sales s
      LEFT JOIN customers c ON c.customer_uuid = s.customer_uuid
      WHERE s.created_at BETWEEN ? AND ?
      ORDER BY s.created_at ASC
    `).all(startDate, endDate);

      // Summary
      const summary = db.prepare(`
      SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(total), 0) as total_taxable,
        COALESCE(SUM(tax), 0) as total_tax,
        COALESCE(SUM(grand_total), 0) as grand_total,
        COALESCE((SELECT SUM(refund_amount) FROM medicine_returns WHERE return_type = 'customer_return' AND created_at BETWEEN ? AND ?), 0) as total_refunds
      FROM sales
      WHERE created_at BETWEEN ? AND ?
    `).get(startDate, endDate, startDate, endDate) as any;

      res.json({
        success: true,
        data: {
          shop,
          slabs,
          exempt_value: exempt.exempt_value,
          invoices,
          summary
        }
      });
    } catch (error) {
      console.error('GST report error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  static getGSTReportByRange = (req: Request, res: Response): void => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate || typeof startDate !== 'string' || typeof endDate !== 'string') {
        res.status(400).json({ success: false, error: 'startDate and endDate parameters required (YYYY-MM-DD)' });
        return;
      }

      // Shop details
      const shop = db.prepare('SELECT shop_name as name, address, mobile, gstin FROM settings LIMIT 1').get() as any || { name: 'My Store' };

      // GST slabs
      const slabs = db.prepare(`
        SELECT 
          gst_percent as tax_percent,
          COUNT(DISTINCT s.sale_uuid) as invoice_count,
          COALESCE(SUM(si.total), 0) as taxable_value,
          COALESCE(SUM(si.gst_amount), 0) as total_tax
        FROM sale_items si
        JOIN sales s ON s.sale_uuid = si.sale_uuid
        WHERE DATE(s.created_at) BETWEEN ? AND ?
          AND si.gst_percent > 0
        GROUP BY si.gst_percent
        ORDER BY si.gst_percent
      `).all(startDate, endDate);

      // Exempt (0% GST)
      const exempt = db.prepare(`
        SELECT COALESCE(SUM(si.total), 0) as exempt_value, COUNT(DISTINCT s.sale_uuid) as exempt_invoices
        FROM sale_items si
        JOIN sales s ON s.sale_uuid = si.sale_uuid
        WHERE DATE(s.created_at) BETWEEN ? AND ?
          AND (si.gst_percent = 0 OR si.gst_percent IS NULL)
      `).get(startDate, endDate) as { exempt_value: number; exempt_invoices: number };

      // Invoices list
      const invoices = db.prepare(`
        SELECT 
          s.sale_uuid,
          s.invoice_number,
          s.created_at,
          c.name as customer_name,
          s.total,
          s.tax,
          s.grand_total,
          (SELECT GROUP_CONCAT(DISTINCT si.gst_percent || '%') FROM sale_items si WHERE si.sale_uuid = s.sale_uuid AND si.gst_percent > 0) as gst_rates
        FROM sales s
        LEFT JOIN customers c ON c.customer_uuid = s.customer_uuid
        WHERE DATE(s.created_at) BETWEEN ? AND ?
        ORDER BY s.created_at ASC
      `).all(startDate, endDate);

      // Summary
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_invoices,
          COALESCE(SUM(total), 0) as total_taxable,
          COALESCE(SUM(tax), 0) as total_tax,
          COALESCE(SUM(grand_total), 0) as grand_total,
          COALESCE((SELECT SUM(refund_amount) FROM medicine_returns WHERE return_type = 'customer_return' AND DATE(created_at) BETWEEN ? AND ?), 0) as total_refunds
        FROM sales
        WHERE DATE(created_at) BETWEEN ? AND ?
      `).get(startDate, endDate, startDate, endDate) as any;

      res.json({
        success: true,
        data: {
          shop,
          slabs,
          exempt_value: exempt.exempt_value,
          invoices,
          summary,
          range: { startDate, endDate }
        }
      });
    } catch (error) {
      console.error('GST report by range error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };

  static dailyReport = (req: AuthRequest, res: Response): void => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== 'string') {
        res.status(400).json({ success: false, error: 'Date parameter required (YYYY-MM-DD)' });
        return;
      }
      const report = ReportModel.getDailyReport(date);
      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Daily report error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}
