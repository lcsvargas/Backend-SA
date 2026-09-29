import { prisma } from '../lib/client.ts';

function parseTransaction(body) {
    const { categoria, descricao, valor, data, tipo } = body;
    const amount = Number(valor);
    const transactionDate = new Date(data);

    if (!categoria || !descricao || !data || !['entrada', 'saida'].includes(tipo) || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(transactionDate.getTime())) {
        return { error: 'Dados da transação inválidos.' };
    }

    return {
        data: {
            categoria,
            descricao,
            valor: amount,
            data: transactionDate,
            tipo,
        },
    };
}

export async function listTransactions(req, res) {
    try {
        const transactions = await prisma.transaction.findMany({
            where: { userid: req.userId },
            orderBy: { id: 'desc' },
        });
        return res.json(transactions);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

export async function createTransaction(req, res) {
    try {
        const parsed = parseTransaction(req.body);

        if (parsed.error) {
            return res.status(400).json({ success: false, error: parsed.error });
        }

        const transaction = await prisma.transaction.create({
            data: { ...parsed.data, userid: req.userId },
        });
        return res.status(201).json(transaction);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

export async function updateTransaction(req, res) {
    try {
        const id = Number(req.params.id);
        const parsed = parseTransaction(req.body);

        if (!Number.isInteger(id) || id <= 0 || parsed.error) {
            const error = parsed.error || 'Dados da transação inválidos.';
            return res.status(400).json({ success: false, error });
        }

        const where = { id, userid: req.userId };
        const result = await prisma.transaction.updateMany({
            where,
            data: parsed.data,
        });

        if (result.count === 0) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
        }

        const transaction = await prisma.transaction.findFirst({ where });
        return res.json(transaction);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

export async function deleteTransaction(req, res) {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
        }

        const result = await prisma.transaction.deleteMany({
            where: { id, userid: req.userId },
        });

        if (result.count === 0) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
        }

        return res.sendStatus(204);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
