import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { requireActive, requireAdmin } from '../auth';
import * as C from '../controllers/moderationController';

/** POST /api/reports: any active signed-in User. */
export const reportRoutes = Router();
reportRoutes.use(requireAuth, requireActive);
reportRoutes.post('/', C.reportMessage);

/** /api/admin/*: active administrators only. */
export const adminRoutes = Router();
adminRoutes.use(requireAuth, requireAdmin);
adminRoutes.get('/stats', C.adminStats);
adminRoutes.get('/reports', C.adminListReports);
adminRoutes.post('/reports/:id/dismiss', C.adminDismissReport);
adminRoutes.post('/reports/:id/suspend', C.adminSuspendFromReport);
adminRoutes.get('/users', C.adminSearchUsers);
adminRoutes.post('/users/:id/suspend', C.adminSetSuspension(true));
adminRoutes.post('/users/:id/unsuspend', C.adminSetSuspension(false));
