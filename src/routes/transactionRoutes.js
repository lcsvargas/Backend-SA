import { Router } from 'express';
import {
    createTransaction,
    deleteTransaction,
    listTransactions,
    updateTransaction,
} from '../controllers/transactionController.js';
import { requireAuth, requireRole } from '../middleware/requireAuth.js';
import { prisma } from '../lib/client.ts';

const router = Router();

router.use(requireAuth);
router.get('/', listTransactions);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);
router.get('/admin/users', requireRole('ADMIN'), async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            where: { deleted: false }, select: { id: true, username: true, email: true, role: true },
            orderBy: { id: 'asc' }, take: 100,
        });
        return res.json({ data: users });
    } catch (error) { return next(error); }
});

export default router;

