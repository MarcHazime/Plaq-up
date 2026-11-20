import { Router } from 'express';
import { updateUser, getUserById, deleteUser, updatePushToken, blockUser, unblockUser, getBlockedUsers, getBlockStatus } from '../controllers/userController';
import * as UserController from '../controllers/userController'; // Assuming UserController is now imported as a whole object for new routes

import { requireActive } from '../auth';
import { requireAuth, requireSelf, requireSelfInBody } from '../auth/middleware';

const router = Router();
router.use(requireAuth, requireActive);

router.get('/:userId/vehicles', requireSelf('userId'), UserController.getVehicles);
router.post('/:userId/vehicles', requireSelf('userId'), UserController.addVehicle);
router.delete('/:userId/vehicles/:id', requireSelf('userId'), UserController.deleteVehicle);

router.get('/search', UserController.searchUser); // ?plate=AA-123-BB
router.get('/:id/settings', requireSelf('id'), UserController.getSettings);
router.get('/:id', getUserById);
router.put('/:id', requireSelf('id'), updateUser);
router.post('/:id/accept-terms', requireSelf('id'), UserController.acceptTerms);
router.put('/:id/push-token', requireSelf('id'), updatePushToken);
router.post('/block', requireSelfInBody('blockerId'), blockUser);
router.post('/unblock', requireSelfInBody('blockerId'), unblockUser);
router.get('/blocked/:userId', requireSelf('userId'), getBlockedUsers);
router.get('/relationship/:userId/:otherId', requireSelf('userId'), getBlockStatus);
router.delete('/:id', requireSelf('id'), deleteUser);

export default router;
