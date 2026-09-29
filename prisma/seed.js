import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/client.ts';

const developmentPassword = 'fintech-dev-123';
const seedUsers = [
    {
        username: 'dev.alice',
        displayname: 'Alice Silva',
        email: 'alice@fintech.local',
        transactions: [
            { categoria: 'Salário', descricao: 'Salário mensal', valor: 5200, data: '2026-09-05', tipo: 'entrada' },
            { categoria: 'Moradia', descricao: 'Aluguel', valor: 1650, data: '2026-09-08', tipo: 'saida' },
            { categoria: 'Alimentação', descricao: 'Mercado', valor: 384.72, data: '2026-09-12', tipo: 'saida' },
        ],
    },
    {
        username: 'dev.bruno',
        displayname: 'Bruno Costa',
        email: 'bruno@fintech.local',
        transactions: [
            { categoria: 'Freelance', descricao: 'Projeto de design', valor: 1800, data: '2026-09-03', tipo: 'entrada' },
            { categoria: 'Transporte', descricao: 'Passe mensal', valor: 210, data: '2026-09-06', tipo: 'saida' },
            { categoria: 'Lazer', descricao: 'Cinema', valor: 68.5, data: '2026-09-14', tipo: 'saida' },
        ],
    },
    {
        username: 'dev.carol',
        displayname: 'Carol Oliveira',
        email: 'carol@fintech.local',
        transactions: [
            { categoria: 'Salário', descricao: 'Salário mensal', valor: 4300, data: '2026-09-04', tipo: 'entrada' },
            { categoria: 'Saúde', descricao: 'Consulta médica', valor: 240, data: '2026-09-09', tipo: 'saida' },
            { categoria: 'Educação', descricao: 'Curso online', valor: 129.9, data: '2026-09-15', tipo: 'saida' },
        ],
    },
];

try {
    for (const seedUser of seedUsers) {
        const passwordHash = await bcrypt.hash(developmentPassword, 10);
        const user = await prisma.user.upsert({
            where: { email: seedUser.email },
            update: {
                username: seedUser.username,
                displayname: seedUser.displayname,
                password: passwordHash,
                deleted: false,
            },
            create: {
                username: seedUser.username,
                displayname: seedUser.displayname,
                email: seedUser.email,
                password: passwordHash,
            },
        });

        await prisma.transaction.deleteMany({ where: { userid: user.id } });
        await prisma.transaction.createMany({
            data: seedUser.transactions.map(transaction => ({
                ...transaction,
                userid: user.id,
                data: new Date(`${transaction.data}T12:00:00.000Z`),
            })),
        });
    }

    console.log(`Seed concluído: ${seedUsers.length} usuários e ${seedUsers.length * 3} transações.`);
} catch (error) {
    console.error('Falha ao executar seed:', error);
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
