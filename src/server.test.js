import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import app from './server.js';
import { prisma } from './lib/client.ts';

const runId = Date.now().toString();
const username = `test${runId}`;
const email = `test${runId}@example.com`;
let server;
let cookie;

async function request(path, options = {}) {
    const headers = new Headers(options.headers);

    if (cookie) {
        headers.set('Cookie', cookie);
    }

    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        ...options,
        headers,
    });
}

test('auth and transaction CRUD use Prisma and preserve the API contract', async () => {
    await prisma.$connect();
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));

    const registerResponse = await request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password: 'test-password' }),
    });
    assert.equal(registerResponse.status, 201);

    const registerBody = await registerResponse.json();
    assert.equal(registerBody.success, true);
    assert.equal(registerBody.user.username, username);
    assert.equal('password' in registerBody.user, false);
    cookie = registerResponse.headers.get('set-cookie')?.split(';', 1)[0];
    assert.ok(cookie);

    const currentUserResponse = await request('/me');
    assert.equal(currentUserResponse.status, 200);
    assert.equal((await currentUserResponse.json()).user.id, registerBody.user.id);

    const emptyListResponse = await request('/transactions');
    assert.equal(emptyListResponse.status, 200);
    assert.deepEqual(await emptyListResponse.json(), []);

    const invalidCreateResponse = await request('/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: 'Teste', descricao: 'Inválida', valor: -1, data: '2026-09-28', tipo: 'saida' }),
    });
    assert.equal(invalidCreateResponse.status, 400);

    const createResponse = await request('/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: 'Teste', descricao: 'Criada no teste', valor: 12.5, data: '2026-09-28', tipo: 'saida' }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.categoria, 'Teste');
    assert.equal(Number(created.valor), 12.5);

    const listResponse = await request('/transactions');
    assert.equal(listResponse.status, 200);
    assert.equal((await listResponse.json()).length, 1);

    const updateResponse = await request(`/transactions/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: 'Atualizada', descricao: 'Editada no teste', valor: 20, data: '2026-09-27', tipo: 'entrada' }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.categoria, 'Atualizada');
    assert.equal(Number(updated.valor), 20);

    const deleteResponse = await request(`/transactions/${created.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 204);

    const finalListResponse = await request('/transactions');
    assert.equal(finalListResponse.status, 200);
    assert.deepEqual(await finalListResponse.json(), []);
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (user) {
        await prisma.transaction.deleteMany({ where: { userid: user.id } });
        await prisma.user.delete({ where: { id: user.id } });
    }

    await prisma.$disconnect();
});
