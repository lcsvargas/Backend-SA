import { prisma } from '../lib/client.ts';

function getPeriod(req, res) {
    const now = new Date();
    const start = req.query.dataInicio ? new Date(req.query.dataInicio) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = req.query.dataFim ? new Date(req.query.dataFim) : now;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        res.status(400).json({ success: false, error: 'Período inválido.' });
        return null;
    }
    return { start, end };
}

export async function getDashboard(req, res) {
    const period = getPeriod(req, res);
    if (!period) return;
    try {
        const base = { userid: req.userId, deletedAt: null };
        const range = { ...base, data: { gte: period.start, lte: period.end } };
        const [all, periodRows, categoryRows, recent] = await Promise.all([
            prisma.transaction.groupBy({ by: ['tipo'], where: base, _sum: { valor: true }, _count: { _all: true } }),
            prisma.transaction.groupBy({ by: ['tipo'], where: range, _sum: { valor: true }, _count: { _all: true } }),
            prisma.transaction.groupBy({ by: ['categoria'], where: { ...range, tipo: 'saida' }, _sum: { valor: true }, orderBy: { _sum: { valor: 'desc' } }, take: 5 }),
            prisma.transaction.findMany({ where: base, orderBy: [{ data: 'desc' }, { id: 'desc' }], take: 5 }),
        ]);
        const totals = rows => {
            const result = { entradas: 0, saidas: 0, saldo: 0, quantidade: 0 };
            for (const row of rows) {
                const value = Number(row._sum.valor || 0);
                result[row.tipo === 'entrada' ? 'entradas' : 'saidas'] = value;
                result.quantidade += row._count._all;
            }
            result.saldo = result.entradas - result.saidas;
            return result;
        };
        return res.json({
            periodo: { inicio: period.start, fim: period.end },
            geral: totals(all),
            periodoAtual: totals(periodRows),
            gastosPorCategoria: categoryRows.map(row => ({ categoria: row.categoria, total: Number(row._sum.valor || 0) })),
            recentes: recent,
        });
    } catch (err) {
        throw err;
    }
}

export async function getReport(req, res) {
    const period = getPeriod(req, res);
    if (!period) return;
    try {
        const where = { userid: req.userId, deletedAt: null, data: { gte: period.start, lte: period.end } };
        if (req.query.tipo) {
            if (!['entrada', 'saida'].includes(req.query.tipo)) return res.status(400).json({ success: false, error: 'Filtro tipo inválido.' });
            where.tipo = req.query.tipo;
        }
        const [byType, byCategory, count] = await Promise.all([
            prisma.transaction.groupBy({ by: ['tipo'], where, _sum: { valor: true }, _count: { _all: true } }),
            prisma.transaction.groupBy({ by: ['categoria', 'tipo'], where, _sum: { valor: true }, _count: { _all: true }, orderBy: { categoria: 'asc' } }),
            prisma.transaction.count({ where }),
        ]);
        return res.json({
            periodo: { inicio: period.start, fim: period.end },
            totalRegistros: count,
            totaisPorTipo: byType.map(row => ({ tipo: row.tipo, total: Number(row._sum.valor || 0), quantidade: row._count._all })),
            totaisPorCategoria: byCategory.map(row => ({ categoria: row.categoria, tipo: row.tipo, total: Number(row._sum.valor || 0), quantidade: row._count._all })),
        });
    } catch (err) {
        throw err;
    }
}


