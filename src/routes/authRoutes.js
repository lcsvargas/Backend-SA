import { Router } from 'express';
import {
    checkAuth,
    getCurrentUser,
    login,
    logout,
    registerUser,
} from '../controllers/authController.js';

const router = Router();

router.post('/register', registerUser);
router.post('/signup', registerUser);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', getCurrentUser);
router.get('/api/check-auth', checkAuth);

export default router;
