import { Router } from 'express';
import { SupplierBillController } from '../controllers/SupplierBillController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/:supplier_uuid/bills', SupplierBillController.index);
router.post('/:supplier_uuid/bills', SupplierBillController.store);
router.delete('/bills/:bill_uuid', SupplierBillController.destroy);

export default router;
