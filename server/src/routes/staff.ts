import { Router } from 'express';
import { StaffController } from '../controllers/staffController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Staff routes — read requires auth, write requires admin
router.use(authenticate);

// Read — admin & manager can view
router.get('/', StaffController.index);
router.get('/summary', StaffController.summary);
router.get('/role/:role', StaffController.byRole);

// Write — admin only
router.post('/', authorize('admin'), StaffController.store);
router.put('/:user_uuid', authorize('admin'), StaffController.update);
router.delete('/:user_uuid', authorize('admin'), StaffController.destroy);

export default router;
