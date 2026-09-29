import { Router } from 'express';
import {
    createTransaction,
    deleteTransaction,
    listTransactions,
    updateTransaction,
} from '../controllers/transactionController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

router.use(requireAuth);
router.get('/', listTransactions);
router.post('/', createTransaction);
router.put('/:id', updateTransaction);
router.delete('/:id', deleteTransaction);

export default router;
