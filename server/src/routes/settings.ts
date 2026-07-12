import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// ✅ Public routes — no auth needed
router.get('/license/status', SettingsController.licenseStatus);
router.post('/license/activate', SettingsController.activateLicense);

// All settings routes require authentication
router.use(authenticate);

// GET settings (any authenticated user)
router.get('/', SettingsController.get);

// POST save settings (admin only)
router.post('/', authorize('admin'), SettingsController.save);

// PUT update settings (admin only)
router.put('/', authorize('admin'), SettingsController.update);

// Additional routes for backup management (admin only)
router.post('/backup', authorize('admin'), SettingsController.backup);
router.get('/backups', authorize('admin'), SettingsController.listBackups);
router.post('/restore', authorize('admin'), SettingsController.restore);
router.post('/test-print', authorize('admin'), SettingsController.testPrint);

export default router;
