import { Router } from 'express';
import { ProductController } from '../controllers/productController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', ProductController.create);
router.get('/', ProductController.index);
router.get('/search', ProductController.search);
router.get('/low-stock', ProductController.lowStock);
router.get('/:uuid', ProductController.show);
router.put('/:uuid', ProductController.update);
router.delete('/:uuid', ProductController.destroy);

export default router;
