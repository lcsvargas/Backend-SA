import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import app from './server.js';
import { prisma } from './lib/client.ts';

const runId = Date.now().toString();
const firstUsername = `test${runId}`;
const firstEmail = `test${runId}@example.com`;
const secondUsername = `other${runId}`;
const secondEmail = `other${runId}@example.com`;
let server;

async function request(path, options = {}) {
    const { token, ...fetchOptions } = options;
    const headers = new Headers(fetchOptions.headers);

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        ...fetchOptions,
        headers,
    });
}

test('JWT authentication protects user and transaction routes and isolates CRUD by user', async () => {
    await prisma.$connect();
    server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));

    const unauthorizedResponse = await request('/auth/me');
    assert.equal(unauthorizedResponse.status, 401);
    const invalidTokenResponse = await request('/auth/me', { token: 'invalid-token' });
    assert.equal(invalidTokenResponse.status, 401);
    const unauthorizedTransactionResponse = await request('/transactions');
    assert.equal(unauthorizedTransactionResponse.status, 401);

    const registerResponse = await request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: firstUsername, email: firstEmail, password: 'test-password' }),
    });
    assert.equal(registerResponse.status, 201);

    const registerBody = await registerResponse.json();
    assert.equal(registerBody.success, true);
    assert.equal(registerBody.user.username, firstUsername);
    assert.equal('password' in registerBody.user, false);
    assert.ok(registerBody.token);
    assert.equal(registerResponse.headers.has('set-cookie'), false);

    const loginResponse = await request('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: firstEmail, password: 'test-password' }),
    });
    assert.equal(loginResponse.status, 200);
    const loginBody = await loginResponse.json();
    assert.ok(loginBody.token);

    const currentUserResponse = await request('/auth/me', { token: loginBody.token });
    assert.equal(currentUserResponse.status, 200);
    assert.equal((await currentUserResponse.json()).user.id, registerBody.user.id);

    const aliasCurrentUserResponse = await request('/me', { token: loginBody.token });
    assert.equal(aliasCurrentUserResponse.status, 200);

    const emptyListResponse = await request('/transactions', { token: loginBody.token });
    assert.equal(emptyListResponse.status, 200);
    assert.deepEqual(await emptyListResponse.json(), []);

    const invalidCreateResponse = await request('/transactions', {
        token: loginBody.token,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: 'Teste', descricao: 'Inválida', valor: -1, data: '2026-09-28', tipo: 'saida' }),
    });
    assert.equal(invalidCreateResponse.status, 400);

    const createResponse = await request('/transactions', {
        token: loginBody.token,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: 'Teste', descricao: 'Criada no teste', valor: 12.5, data: '2026-09-28', tipo: 'saida' }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.categoria, 'Teste');
    assert.equal(Number(created.valor), 12.5);

    const secondRegisterResponse = await request('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: secondUsername, email: secondEmail, password: 'test-password' }),
    });
    assert.equal(secondRegisterResponse.status, 201);
    const secondRegisterBody = await secondRegisterResponse.json();

    const otherUserListResponse = await request('/transactions', { token: secondRegisterBody.token });
    assert.deepEqual(await otherUserListResponse.json(), []);

    const otherUserUpdateResponse = await request(`/transactions/${created.id}`, {
        token: secondRegisterBody.token,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: 'Invadida', descricao: 'Não deve alterar', valor: 1, data: '2026-09-28', tipo: 'saida' }),
    });
    assert.equal(otherUserUpdateResponse.status, 404);

    const otherUserDeleteResponse = await request(`/transactions/${created.id}`, {
        token: secondRegisterBody.token,
        method: 'DELETE',
    });
    assert.equal(otherUserDeleteResponse.status, 404);

    const listResponse = await request('/transactions', { token: loginBody.token });
    assert.equal(listResponse.status, 200);
    assert.equal((await listResponse.json()).length, 1);

    const updateResponse = await request(`/transactions/${created.id}`, {
        token: loginBody.token,
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: 'Atualizada', descricao: 'Editada no teste', valor: 20, data: '2026-09-27', tipo: 'entrada' }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json();
    assert.equal(updated.categoria, 'Atualizada');
    assert.equal(Number(updated.valor), 20);

    const deleteResponse = await request(`/transactions/${created.id}`, {
        token: loginBody.token,
        method: 'DELETE',
    });
    assert.equal(deleteResponse.status, 204);

    const finalListResponse = await request('/transactions', { token: loginBody.token });
    assert.equal(finalListResponse.status, 200);
    assert.deepEqual(await finalListResponse.json(), []);
});

after(async () => {
    if (server) {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }

    for (const username of [firstUsername, secondUsername]) {
        const user = await prisma.user.findUnique({ where: { username } });
        if (user) {
            await prisma.transaction.deleteMany({ where: { userid: user.id } });
            await prisma.user.delete({ where: { id: user.id } });
        }
    }

    await prisma.$disconnect();
});
