import { Router } from 'express';
import { getVehicleInfo, scanPlate } from '../controllers/sivController';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
import { requireActive } from '../auth';
import { requireAuth } from '../auth/middleware';

const router = Router();
router.use(requireAuth, requireActive);

router.get('/:plate', getVehicleInfo);
router.post('/scan', upload.single('image'), scanPlate);

export default router;
