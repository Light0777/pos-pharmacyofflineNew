// routes/productUnits.ts

import { Router } from 'express';

import {
  ProductUnitController
} from '../controllers/productUnitController';

import {
  authenticate
} from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  ProductUnitController.getAllUnits
)
// CREATE
router.post(
  '/',
  ProductUnitController.create
);

// GET PRODUCT UNITS
router.get(
  '/product/:product_uuid',
  ProductUnitController.getByProduct
);

// DELETE
router.delete(
  '/:uuid',
  ProductUnitController.destroy
);

export default router;