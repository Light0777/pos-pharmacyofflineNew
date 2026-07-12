import { Router } from 'express';
import { SupplierController } from '../controllers/supplierController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All supplier routes require authentication
router.use(authenticate);

// Read routes — any authenticated user
router.get('/', SupplierController.index);

// Write routes — admin only
router.post('/', authorize('admin'), SupplierController.store);
router.put('/:supplier_uuid', authorize('admin'), SupplierController.update);
router.delete('/:supplier_uuid', authorize('admin'), SupplierController.destroy);

export default router;
