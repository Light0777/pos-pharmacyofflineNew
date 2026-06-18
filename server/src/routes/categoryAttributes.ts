// routes/categoryAttributes.ts

import { Router } from 'express';

import {
  CategoryAttributeController
} from '../controllers/categoryAttributeController';

import {
  authenticate
} from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ASSIGN
router.post(
  '/',
  CategoryAttributeController.assign
);

// GET ALL MAPPINGS
router.get(
  '/',
  CategoryAttributeController.index
);

// GET CATEGORY ATTRIBUTES
router.get(
  '/:category_uuid',
  CategoryAttributeController.getByCategory
);

// REMOVE ATTRIBUTE FROM CATEGORY
router.delete(
  '/',
  CategoryAttributeController.remove
);

export default router;