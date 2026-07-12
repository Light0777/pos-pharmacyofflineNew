import { Router } from 'express';

import {
  MedicineReturnController
} from '../controllers/medicineReturnController';

import {
  authenticate,
  authorize
} from '../middleware/auth';

const router = Router();

router.use(authenticate);

// LIST
router.get(
  '/',
  authorize(
    'admin',
    'manager'
  ),
  MedicineReturnController.index
);

// CREATE
router.post(
  '/',
  authorize(
    'admin'
  ),
  MedicineReturnController.create
);

export default router;