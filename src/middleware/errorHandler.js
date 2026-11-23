export function notFoundHandler(req, res) {
    return res.status(404).json({ success: false, error: 'Rota não encontrada.' });
}

export function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    const prismaStatus = error.code === 'P2002' ? 409 : error.code === 'P2025' ? 404 : null;
    const status = Number.isInteger(error.status) ? error.status : prismaStatus || (error.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(error);
    return res.status(status).json({ success: false, error: status >= 500 ? 'Erro interno do servidor.' : error.message });
}
