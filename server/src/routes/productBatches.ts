import { Router } from 'express';
import { ProductBatchController } from '../controllers/ProductBatchController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Read routes — any authenticated user
router.get('/search', ProductBatchController.search);
router.get('/product/:product_uuid', ProductBatchController.getByProduct);
router.get('/available/:product_uuid', ProductBatchController.available);
router.get('/near-expiry', ProductBatchController.nearExpiry);
router.get('/expired', ProductBatchController.expired);

// Write routes — admin only
router.post('/', authorize('admin'), ProductBatchController.create);
router.post('/consume-fefo', authorize('admin'), ProductBatchController.consumeFEFO);
router.post('/quarantine-expired', authorize('admin'), ProductBatchController.quarantineExpired);
router.put('/:batch_uuid', authorize('admin'), ProductBatchController.update);
router.delete('/:batch_uuid', authorize('admin'), ProductBatchController.deleteBatch);

export default router;