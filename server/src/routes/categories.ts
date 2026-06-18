// routes/categories.ts

import { Router } from 'express';

import {
  CategoryController
} from '../controllers/categoryController';

import {
  authenticate
} from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CREATE
router.post(
  '/',
  CategoryController.create
);

// LIST
router.get(
  '/',
  CategoryController.index
);

// DELETE
router.delete(
  '/:uuid',
  CategoryController.destroy
);

// UPDATE
router.put(
  '/:uuid',
  CategoryController.update
);

export default router;