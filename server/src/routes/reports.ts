import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All report routes require authentication
router.use(authenticate);

// Main report routes (matching PHP)
router.get('/dashboard', ReportController.dashboard);
router.get('/top-products', ReportController.topProducts);
router.get('/recent-purchases', ReportController.recentPurchases);
router.get('/stock', ReportController.stock);
router.get('/profit', ReportController.profit);
router.get('/sales-trend', ReportController.salesTrend);
router.get('/profit-trend', ReportController.profitTrend);

// Additional useful report routes
router.get('/sales-by-payment', ReportController.salesByPayment);
router.get('/daily-sales', ReportController.dailySales);
router.get('/product-sales', ReportController.productSales);
router.get('/customer-purchases', ReportController.customerPurchases);
router.get('/customer-trend', ReportController.customerTrend);
router.get('/gst-report', authenticate, authorize('admin', 'manager'), ReportController.getGSTReport);
router.get('/gst-report-range', authenticate, authorize('admin', 'manager'), ReportController.getGSTReportByRange);
router.get('/daily-report', authenticate, authorize('admin', 'manager'), ReportController.dailyReport);

export default router;
