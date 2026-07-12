import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Read routes — any authenticated user
router.get('/', ProductController.index);
router.get('/search', ProductController.search);
router.get('/low-stock', ProductController.lowStock);
router.get('/:uuid', ProductController.show);

// Write routes — admin only
router.post('/', authorize('admin'), ProductController.create);
router.put('/:uuid', authorize('admin'), ProductController.update);
router.delete('/:uuid', authorize('admin'), ProductController.destroy);

export default router;
