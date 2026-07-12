import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';
import { CustomerPaymentController } from '../controllers/customerPaymentController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All customer routes require authentication
router.use(authenticate);

// Read routes — any authenticated user
router.get('/', CustomerController.index);
router.get('/search', CustomerController.search);
router.get('/summary', CustomerController.summary);
router.get('/aging', CustomerController.aging);
router.get('/reminders', CustomerController.reminders);
router.get('/credit-trend', CustomerController.creditTrend);
router.get('/:customer_uuid', (req, res) => {
  const { CustomerModel } = require('../models/Customer');
  const customer = CustomerModel.findById(String(req.params.customer_uuid));
  if (!customer) {
    res.status(404).json({ success: false, error: 'Customer not found' });
    return;
  }
  res.json({ success: true, data: customer });
});
router.get('/:customer_uuid/ledger', CustomerController.ledger);

// Write routes — admin only
router.post('/', authorize('admin'), CustomerController.store);
router.put('/:customer_uuid', authorize('admin'), CustomerController.update);
router.delete('/:customer_uuid', authorize('admin'), CustomerController.destroy);
router.post('/:customer_uuid/payments', authorize('admin'), CustomerPaymentController.store);

export default router;
