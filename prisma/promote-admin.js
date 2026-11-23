import 'dotenv/config';
import { prisma } from '../src/lib/client.ts';

const username = process.argv[2]?.trim();
if (!username) {
    console.error('Uso: npm run admin:promote -- <username>');
    process.exitCode = 1;
} else {
    try {
        const user = await prisma.user.update({
            where: { username },
            data: { role: 'ADMIN' },
            select: { id: true, username: true, role: true },
        });
        console.log(`Papel atualizado: ${user.username} → ${user.role}. Faça login novamente para obter um token atualizado.`);
    } catch (error) {
        console.error(error.code === 'P2025' ? 'Usuário não encontrado.' : 'Não foi possível promover o usuário.');
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}
