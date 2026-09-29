export function requireAuth(req, res, next) {
    if (!req.session.user?.id) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    return next();
}
