import { Router } from 'express';
import { getVehicleInfo, scanPlate } from '../controllers/sivController';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
import { requireAuth } from '../auth/middleware';

const router = Router();
router.use(requireAuth);

router.get('/:plate', getVehicleInfo);
router.post('/scan', upload.single('image'), scanPlate);

export default router;
