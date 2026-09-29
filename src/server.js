import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import clr from 'connect-livereload';
import { pathToFileURL } from 'node:url';
import { prisma } from './lib/client.ts';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
];

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
}));

app.use(express.static('public'));
app.use(clr());
app.use(express.json());
app.use(authRoutes);
app.use('/transactions', transactionRoutes);

export default app;

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET não está definida no .env.');
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
