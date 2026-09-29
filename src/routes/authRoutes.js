import { Router } from 'express';
import {
    checkAuth,
    getCurrentUser,
    login,
    logout,
    registerUser,
} from '../controllers/authController.js';
import { optionalAuth, requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.post('/register', registerUser);
router.post('/signup', registerUser);
router.post('/login', login);
router.post('/logout', logout);
router.post('/auth/register', registerUser);
router.post('/auth/signup', registerUser);
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/me', requireAuth, getCurrentUser);
router.get('/auth/me', requireAuth, getCurrentUser);
router.get('/api/check-auth', optionalAuth, checkAuth);

export default router;
