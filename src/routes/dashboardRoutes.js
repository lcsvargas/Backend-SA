import { Router } from 'express';
import { getDashboard, getReport } from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/', getDashboard);
router.get('/reports', getReport);

export default router;
