import { Router } from 'express';
import { SaleController } from '../controllers/saleController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All sale routes require authentication
router.use(authenticate);

// List sales and get single sale
router.get('/next-invoice', SaleController.nextInvoice);
router.get('/', SaleController.index);
router.get('/:sale_uuid', SaleController.show);
router.get('/:sale_uuid/invoice', SaleController.getInvoice); // ADD THIS LINE

export default router;