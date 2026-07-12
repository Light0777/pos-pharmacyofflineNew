import { Router } from 'express';
import { CartController } from '../controllers/cartController';
import { SaleController } from '../controllers/saleController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All cart routes require authentication
router.use(authenticate);

// Cart CRUD
router.post('/', CartController.create);
router.get('/held', CartController.heldCarts);
router.get('/:cart_uuid', CartController.show);

// Cart status management
router.post('/:cart_uuid/hold', CartController.hold);
router.post('/:cart_uuid/resume', CartController.resume);
router.post('/:cart_uuid/clear', CartController.clear);

// Item management
router.post('/:cart_uuid/items', CartController.addItem);
router.put('/:cart_uuid/items/:product_uuid', CartController.updateItem);
router.delete('/:cart_uuid/items/:product_uuid', CartController.removeItem);

// Discount
router.post('/:cart_uuid/discount', CartController.applyDiscount);

// Checkout (requires cashier role or higher)
router.post('/:cart_uuid/checkout', 
  authorize('admin', 'manager', 'cashier'), 
  SaleController.checkout
);

router.put('/:cart_uuid/items/:product_uuid/:unit_uuid',CartController.updateItem);

router.delete('/:cart_uuid/items/:product_uuid/:unit_uuid',CartController.removeItem);

router.get('/', CartController.getAll);

router.delete('/:cart_uuid', CartController.deleteByUuid);

export default router;
