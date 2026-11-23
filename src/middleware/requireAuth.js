import jwt from 'jsonwebtoken';
import { prisma } from '../lib/client.ts';

function getUserId(req) {
    const authorization = req.get('authorization');
    const match = authorization?.match(/^Bearer\s+(.+)$/i);

    if (!match || !process.env.JWT_SECRET) {
        return null;
    }

    try {
        const payload = jwt.verify(match[1], process.env.JWT_SECRET);
        const userId = Number(payload.userId);
        if (!Number.isInteger(userId) || userId <= 0) return null;
        return { userId, role: typeof payload.role === 'string' ? payload.role : 'USER' };
    } catch {
        return null;
    }
}

export async function requireAuth(req, res, next) {
    const identity = getUserId(req);

    if (!identity) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: identity.userId }, select: { role: true, deleted: true } });
        if (!user || user.deleted) return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
        req.userId = identity.userId;
        req.userRole = user.role || 'USER';
        return next();
    } catch (error) { return next(error); }
}

export async function optionalAuth(req, res, next) {
    const identity = getUserId(req);
    if (!identity) { req.userId = null; req.userRole = null; return next(); }
    try {
        const user = await prisma.user.findUnique({ where: { id: identity.userId }, select: { role: true, deleted: true } });
        req.userId = user && !user.deleted ? identity.userId : null;
        req.userRole = user && !user.deleted ? user.role : null;
        return next();
    } catch (error) { return next(error); }
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({ success: false, error: 'Permissão insuficiente.' });
        }
        return next();
    };
}
