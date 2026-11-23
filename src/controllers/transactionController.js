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
        const { page, pageSize, where, orderBy } = parseListQuery(req);
        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({ where, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
            prisma.transaction.count({ where }),
        ]);
        if (!Object.keys(req.query).length) return res.json(transactions);
        return res.json({ data: transactions, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ success: false, error: err.message });
        throw err;
    }
}

function parseListQuery(req) {
    const query = req.query;
    const page = query.page === undefined ? 1 : Number(query.page);
    const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw Object.assign(new Error('page deve ser >= 1 e pageSize deve estar entre 1 e 100.'), { status: 400 });
    }
    const where = { userid: req.userId };
    if (query.tipo) {
        if (!['entrada', 'saida'].includes(query.tipo)) throw Object.assign(new Error('Filtro tipo inválido.'), { status: 400 });
        where.tipo = query.tipo;
    }
    if (query.categoria) where.categoria = { equals: String(query.categoria).slice(0, 100), mode: 'insensitive' };
    if (query.q) where.OR = ['descricao', 'categoria'].map(field => ({ [field]: { contains: String(query.q).slice(0, 100), mode: 'insensitive' } }));
    if (query.dataInicio || query.dataFim) {
        where.data = {};
        if (query.dataInicio) {
            const start = new Date(query.dataInicio);
            if (Number.isNaN(start.getTime())) throw Object.assign(new Error('dataInicio inválida.'), { status: 400 });
            where.data.gte = start;
        }
        if (query.dataFim) {
            const end = new Date(query.dataFim);
            if (Number.isNaN(end.getTime())) throw Object.assign(new Error('dataFim inválida.'), { status: 400 });
            end.setUTCHours(23, 59, 59, 999);
            where.data.lte = end;
        }
    }
    const allowedSort = ['id', 'data', 'valor', 'categoria', 'descricao'];
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'id';
    if (query.sortBy && !allowedSort.includes(query.sortBy)) throw Object.assign(new Error('sortBy inválido.'), { status: 400 });
    if (query.sortOrder && !['asc', 'desc'].includes(query.sortOrder)) throw Object.assign(new Error('sortOrder inválido.'), { status: 400 });
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    return { page, pageSize, where, orderBy: { [sortBy]: sortOrder } };
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
        throw err;
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
        throw err;
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
        throw err;
    }
}


