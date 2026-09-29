import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/client.ts';

function createToken(user) {
    return jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
}

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

export async function registerUser(req, res) {
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

        return res.status(201).json({
            success: true,
            token: createToken(user),
            user: publicUser(user),
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

export async function login(req, res) {
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

        return res.json({
            success: true,
            token: createToken(user),
            user: publicUser(user),
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

export function logout(req, res) {
    return res.json({ success: true });
}

export async function getCurrentUser(req, res) {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        if (!user || user.deleted) {
            return res.status(401).json({ success: false, error: 'Usuário não autenticado.' });
        }

        return res.json({ success: true, user: publicUser(user) });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

export async function checkAuth(req, res) {
    let user = null;

    if (req.userId) {
        const record = await prisma.user.findUnique({ where: { id: req.userId } });
        if (record && !record.deleted) {
            user = publicUser(record);
        }
    }

    return res.json({
        loggedIn: Boolean(user),
        user,
    });
}
