import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { runMigrations } from './database/migrations/001_initial';
import { runMigration as runSecurityQuestionsMigration } from './database/migrations/002_security_questions';
import { runMigration as runSupplierBillsMigration } from './database/migrations/003_supplier_bills';
import { runMigration as runRolesMigration } from './database/migrations/004_roles';
import printingRoutes from './routes/printing';

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/carts';
import saleRoutes from './routes/sales';
import settingsRoutes from './routes/settings';
import customerRoutes from './routes/customers';
import purchaseRoutes from './routes/purchases';
import supplierRoutes from './routes/suppliers';
import reportRoutes from './routes/reports';
import staffRoutes from './routes/staff';
import categoryAttributeRoutes from './routes/categoryAttributes';
import productUnitRoutes from './routes/productUnits';
import productBatchRoutes from './routes/productBatches';

import { LicenseService } from './services/licenseService';

import { scheduleAutoBackup, checkDbIntegrity } from './database/backup';

import attributeRoutes
  from './routes/attributes';

import categoryRoutes
  from './routes/categories';

import stockAdjustmentRoutes
  from './routes/stockAdjustmentRoutes';

import medicineReturnRoutes
  from './routes/medicineReturnRoutes';

import h1RegisterRoutes
  from './routes/h1RegisterRoutes';

import supplierBillRoutes
  from './routes/supplierBills';

import auditLogRoutes
  from './routes/auditLogRoutes';

import autoUpdateRoutes from "./routes/autoUpdateRoutes";
import importRoutes from './routes/import.routes';


// Load environment variables - simplified for CommonJS
dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Run database migrations
runMigrations();
runSecurityQuestionsMigration();
runSupplierBillsMigration();
runRolesMigration();

const licensed = LicenseService.isLicensed();
if (!licensed) {
  console.log('⚠️ App not licensed');
  // Don't block server start — let frontend handle it
  process.env.APP_LICENSED = 'false';
} else {
  process.env.APP_LICENSED = 'true';
}

// After startServer():

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/suppliers', supplierBillRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/printing', printingRoutes);

app.use(
  '/api/attributes',
  attributeRoutes
);

app.use(
  '/api/categories',
  categoryRoutes
);

app.use(
  '/api/category-attributes',
  categoryAttributeRoutes
);

app.use(
  '/api/product-units',
  productUnitRoutes
);

app.use(
  '/api/product-batches',
  productBatchRoutes
);

app.use(
  '/api/stock-adjustments',
  stockAdjustmentRoutes
);

app.use(
  '/api/medicine-returns',
  medicineReturnRoutes
);

app.use(
  '/api/h1-register',
  h1RegisterRoutes
);

app.use(
  '/api/audit-logs',
  auditLogRoutes
);

app.use(
  "/api/auto-update", 
  autoUpdateRoutes
);

app.use("/api/import", importRoutes);



// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'POS Billing API',
    version: '1.0.0',
    status: 'running'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Export startServer function for Electron
export function startServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
        resolve();
      });
      server.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

// Check if running in Electron
const isElectron = process.env.ELECTRON_RUNNING === 'true';
// const isMainModule = typeof require !== 'undefined' && require.main === module;

// Only auto-start if:
// 1. Not in Electron (Electron will call startServer manually)
// 2. It's the main module
// if (isMainModule) {
startServer()
  .then(() => {
    const isHealthy = checkDbIntegrity();
    if (!isHealthy) {
      console.error('⚠️ DB integrity check failed on startup!');
    }
    scheduleAutoBackup();
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
// }

export default app;
