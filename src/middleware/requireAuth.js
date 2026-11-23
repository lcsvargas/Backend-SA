import jwt from 'jsonwebtoken';

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

export function requireAuth(req, res, next) {
    const identity = getUserId(req);

    if (!identity) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    req.userId = identity.userId;
    req.userRole = identity.role;
    return next();
}

export function optionalAuth(req, res, next) {
    const identity = getUserId(req);
    req.userId = identity?.userId ?? null;
    req.userRole = identity?.role ?? null;
    return next();
}

export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({ success: false, error: 'Permissão insuficiente.' });
        }
        return next();
    };
}
