import { Router } from 'express';
import { ProductBatchController } from '../controllers/ProductBatchController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.post('/', ProductBatchController.create);
router.get('/search', ProductBatchController.search);
router.get('/product/:product_uuid', ProductBatchController.getByProduct);
router.get('/available/:product_uuid', ProductBatchController.available);
router.post('/consume-fefo', ProductBatchController.consumeFEFO);
router.get('/near-expiry', ProductBatchController.nearExpiry);
router.get('/expired', ProductBatchController.expired);
router.post('/quarantine-expired', ProductBatchController.quarantineExpired);
router.put('/:batch_uuid', ProductBatchController.update);
router.delete('/:batch_uuid', ProductBatchController.deleteBatch);   // ← was missing

export default router;