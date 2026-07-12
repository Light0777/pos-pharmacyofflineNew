import { Router } from 'express';

import {
  StockAdjustmentController
} from '../controllers/stockAdjustmentController';

import {
  authenticate,
  authorize
} from '../middleware/auth';

const router = Router();

router.use(authenticate);

// LIST
router.get(
  '/',
  StockAdjustmentController.index
);

// CREATE
router.post(
  '/',
  authorize('admin'),
  StockAdjustmentController.create
);

export default router;