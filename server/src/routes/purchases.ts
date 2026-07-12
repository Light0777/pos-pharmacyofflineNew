import { Router } from 'express';
import { PurchaseController } from '../controllers/purchaseController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All purchase routes require authentication
router.use(authenticate);

// Read routes — any authenticated user
router.get('/', PurchaseController.index);

// Write routes — admin only
router.post('/', authorize('admin'), PurchaseController.store);
router.put('/:purchase_uuid', authorize('admin'), PurchaseController.update);

export default router;
