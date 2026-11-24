import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { prisma } from './lib/client.ts';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
app.disable('x-powered-by');
const port = process.env.PORT || 3000;

const allowedOrigins = (process.env.CORS_ORIGINS || [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
].join(',')).split(',').map(origin => origin.trim()).filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

            return callback(Object.assign(new Error('Origin not allowed by CORS'), { status: 403 }));
    },
    credentials: true,
}));

app.use(express.static('public'));
if (process.env.NODE_ENV !== 'production') {
    const { default: liveReload } = await import('connect-livereload');
    app.use(liveReload());
}
app.use(express.json({ limit: '1mb' }));
app.get('/health', async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        return res.status(200).json({ status: 'ok' });
    } catch {
        return res.status(503).json({ status: 'unavailable' });
    }
});
app.get('/openapi.yaml', (req, res) => res.sendFile(fileURLToPath(new URL('../openapi.yaml', import.meta.url))));
app.use(authRoutes);
app.use('/transactions', transactionRoutes);
app.use('/dashboard', dashboardRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET não está definida no .env.');
        }
        if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.length < 32) {
            throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres em produção.');
        }
        if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não está definida no .env.');
        if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS?.trim()) {
            throw new Error('CORS_ORIGINS deve listar a origem HTTPS do frontend em produção.');
        }

        await prisma.$connect();
        app.listen(port, () => {
            console.log(`Running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to connect to the database:', error);
        await prisma.$disconnect();
        process.exitCode = 1;
    }
}
