import express from 'express';
import session from 'express-session';
import cors from 'cors';
import clr from 'connect-livereload';
import bcrypt from 'bcrypt';
import { prisma } from './lib/client.ts';

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

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        maxAge: 1000 * 60 * 60 * 24,
    },
}));

app.use(express.static('public'));
app.use(clr());
app.use(express.json());

function publicUser(user) {
    return {
        id: user.id,
        userid: user.id,
        username: user.username,
        displayname: user.displayname,
        email: user.email,
        pfp: user.pfp,
    };
}

function requireAuth(req, res, next) {
    if (!req.session.user?.id) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    return next();
}

function validateUser({ username, email, password, confirmation }) {
    if (!username || username.trim().length < 3) {
        return 'O usuário deve ter pelo menos 3 caracteres.';
    }

    if (!email || !email.includes('@')) {
        return 'Informe um e-mail válido.';
    }

    if (!password || password.length < 6) {
        return 'A senha deve ter pelo menos 6 caracteres.';
    }

    if (confirmation && password !== confirmation) {
        return 'As senhas não conferem.';
    }

    return null;
}

async function registerUser(req, res) {
    try {
        const username = req.body.username?.trim();
        const displayname = (req.body.displayname || req.body.disp)?.trim() || username;
        const email = req.body.email?.trim().toLowerCase();
        const password = req.body.password || '';
        const confirmation = req.body.confirmation || req.body.confirmPassword;
        const validationError = validateUser({ username, email, password, confirmation });

        if (validationError) {
            return res.status(400).json({ success: false, error: validationError });
        }

        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { username: { equals: username, mode: 'insensitive' } },
                ],
            },
        });

        if (existing) {
            return res.status(409).json({ success: false, error: 'Usuário ou e-mail já cadastrado.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, displayname, email, password: passwordHash },
        });

        req.session.user = publicUser(user);
        return res.status(201).json({ success: true, user: req.session.user });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

app.post('/register', registerUser);
app.post('/signup', registerUser);

app.post('/login', async (req, res) => {
    try {
        const identifier = req.body.email?.trim().toLowerCase();
        const password = req.body.password || '';

        if (!identifier || !password) {
            return res.status(400).json({ success: false, error: 'Informe e-mail/usuário e senha.' });
        }

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { username: { equals: identifier, mode: 'insensitive' } },
                ],
            },
        });

        if (!user || user.deleted) {
            return res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);

        if (!passwordMatches) {
            return res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
        }

        req.session.user = publicUser(user);
        return res.json({ success: true, user: req.session.user });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        res.clearCookie('connect.sid');
        return res.json({ success: true });
    });
});

app.get('/me', (req, res) => {
    if (!req.session.user?.id) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
    }

    return res.json({ success: true, user: req.session.user });
});

app.get('/api/check-auth', (req, res) => {
    return res.json({
        loggedIn: Boolean(req.session.user?.id),
        user: req.session.user || null,
    });
});

app.get('/transactions', requireAuth, async (req, res) => {
    try {
        const trs = await prisma.transaction.findMany({
            where: { userid: req.session.user.id },
            orderBy: { id: 'desc' },
        });
        return res.json(trs);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/transactions', requireAuth, async (req, res) => {
    try {
        const { categoria, descricao, valor, data, tipo } = req.body;
        const amount = Number(valor);
        const transactionDate = new Date(data);

        if (!categoria || !descricao || !data || !['entrada', 'saida'].includes(tipo) || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(transactionDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Dados da transação inválidos.' });
        }

        const nova = await prisma.transaction.create({
            data: {
                userid: req.session.user.id,
                categoria,
                descricao,
                valor: amount,
                data: transactionDate,
                tipo,
            },
        });

        return res.status(201).json(nova);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/transactions/:id', requireAuth, async (req, res) => {
    try {
        const { categoria, descricao, valor, data, tipo } = req.body;
        const id = Number(req.params.id);
        const amount = Number(valor);
        const transactionDate = new Date(data);

        if (!Number.isInteger(id) || id <= 0 || !categoria || !descricao || !data || !['entrada', 'saida'].includes(tipo) || !Number.isFinite(amount) || amount <= 0 || Number.isNaN(transactionDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Dados da transação inválidos.' });
        }

        const where = { id, userid: req.session.user.id };
        const result = await prisma.transaction.updateMany({
            where,
            data: {
                categoria,
                descricao,
                valor: amount,
                data: transactionDate,
                tipo,
            },
        });

        if (result.count === 0) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
        }

        const trs = await prisma.transaction.findFirst({ where });
        return res.json(trs);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/transactions/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
        }

        const result = await prisma.transaction.deleteMany({
            where: { id, userid: req.session.user.id },
        });

        if (result.count === 0) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
        }

        return res.sendStatus(204);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

async function startServer() {
    try {
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

startServer();
