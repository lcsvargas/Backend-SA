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
        return Number.isInteger(userId) && userId > 0 ? userId : null;
    } catch {
        return null;
    }
}

export function requireAuth(req, res, next) {
    const userId = getUserId(req);

    if (!userId) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    req.userId = userId;
    return next();
}

export function optionalAuth(req, res, next) {
    req.userId = getUserId(req);
    return next();
}
