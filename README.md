# FinançaS --- Documentação do Backend

## 1. Visão geral

O backend atual utiliza **Node.js + Express + Prisma + PostgreSQL +
JWT**.

O acesso ao banco é feito pelo Prisma Client utilizando o adaptador
`@prisma/adapter-pg`. A autenticação utiliza JWT e bcrypt, sem
`express-session`.

Fluxo principal:

``` text
Frontend React
      │
      │ HTTP / JSON
      ▼
Node.js + Express
      │
      ├── Routes
      │
      ├── Middleware JWT
      │
      └── Controllers
              │
              ▼
            Prisma
              │
              ▼
          PostgreSQL
```

------------------------------------------------------------------------

## 2. Estrutura atual

``` text
Backend-SA/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── controllers/
│   │   ├── authController.js
│   │   └── transactionController.js
│   ├── lib/
│   │   └── client.ts
│   ├── middleware/
│   │   └── requireAuth.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── transactionRoutes.js
│   └── server.js
├── generated/
│   └── prisma/
├── prisma.config.ts
├── .env
└── package.json
```

O `server.js` configura o Express, CORS, JSON, arquivos estáticos,
Prisma e as rotas. A lógica de autenticação fica em `authController.js`,
enquanto o CRUD de transações fica em `transactionController.js`.

------------------------------------------------------------------------

## 3. Banco de dados

O banco utiliza PostgreSQL.

O Prisma possui dois modelos principais:

``` text
User
 └── transactions[]

Transaction
 └── user
```

### User

Campos principais:

-   `id`
-   `username`
-   `displayname`
-   `email`
-   `password`
-   `pfp`
-   `deleted`

### Transaction

Campos:

-   `id`
-   `userid`
-   `categoria`
-   `descricao`
-   `valor`
-   `data`
-   `tipo`

A relação é:

``` text
User 1 ───────── N Transaction
```

O `userid` de cada transação é obtido do usuário autenticado, evitando
que o cliente escolha livremente o proprietário da transação.

O valor utiliza `Decimal` e a data utiliza `DateTime`.

------------------------------------------------------------------------

## 4. Prisma

O projeto utiliza Prisma 7 com `@prisma/adapter-pg`.

A conexão é configurada em:

``` text
src/lib/client.ts
```

A configuração do Prisma utiliza:

``` text
prisma.config.ts
```

O schema está em:

``` text
prisma/schema.prisma
```

As migrations ficam em:

``` text
prisma/migrations/
```

------------------------------------------------------------------------

## 5. Autenticação JWT

A autenticação atual é baseada exclusivamente em JWT.

### Registro

``` text
POST /auth/register
```

O backend:

1.  Valida os dados recebidos.
2.  Verifica se e-mail ou usuário já existem.
3.  Gera o hash da senha com bcrypt.
4.  Cria o usuário no PostgreSQL através do Prisma.
5.  Gera um JWT.
6.  Retorna o usuário público e o token.

A senha nunca é enviada na resposta.

### Login

``` text
POST /auth/login
```

O backend:

1.  Recebe e-mail/usuário e senha.
2.  Localiza o usuário.
3.  Verifica se o usuário não está marcado como excluído.
4.  Compara a senha com bcrypt.
5.  Gera um JWT com o `userId`.
6.  Retorna o token e os dados públicos do usuário.

O token possui validade de 1 dia.

### Middleware

O arquivo:

``` text
src/middleware/requireAuth.js
```

lê:

``` text
Authorization: Bearer <token>
```

e valida o token com `JWT_SECRET`.

Quando válido:

``` text
req.userId = ID do usuário
```

Esse ID é utilizado pelos controllers.

------------------------------------------------------------------------

## 6. Endpoints de autenticação

### Endpoints principais

  ------------------------------------------------------------------------
  Método            Endpoint           Autenticação      Função
  ----------------- ------------------ ----------------- -----------------
  POST              `/auth/register`   Não               Cadastro

  POST              `/auth/login`      Não               Login e geração
                                                         do JWT

  POST              `/auth/logout`     Não               Retorna sucesso;
                                                         o logout efetivo
                                                         é local

  GET               `/auth/me`         JWT               Retorna o usuário
                                                         autenticado
  ------------------------------------------------------------------------

Também existem aliases de compatibilidade implementados em
`authRoutes.js`:

``` text
POST /register
POST /signup
POST /auth/signup
POST /login
POST /logout
POST /auth/logout
GET  /me
GET  /api/check-auth
```

Os endpoints `/auth/...` são os caminhos canônicos utilizados pelo
frontend atual.

------------------------------------------------------------------------

## 7. Endpoints de transações

Todos os endpoints de transações passam por `requireAuth`.

  Método   Endpoint              Função
  -------- --------------------- ------------------------------
  GET      `/transactions`       Listar transações do usuário
  POST     `/transactions`       Criar transação
  PUT      `/transactions/:id`   Atualizar transação
  DELETE   `/transactions/:id`   Excluir transação

O controller sempre utiliza `req.userId`.

Exemplo:

``` text
GET /transactions
        │
        ▼
JWT Middleware
        │
        ▼
req.userId
        │
        ▼
Prisma
        │
        ▼
WHERE userid = usuário autenticado
```

Além da autenticação, as operações de alteração e exclusão filtram pelo
`userid`, impedindo que um usuário modifique diretamente a transação de
outro usuário.

------------------------------------------------------------------------

## 8. Validação de transações

O backend valida:

-   categoria;
-   descrição;
-   data;
-   tipo (`entrada` ou `saida`);
-   valor numérico;
-   valor maior que zero;
-   data válida.

Requisições inválidas retornam `400`.

Recursos inexistentes ou que não pertencem ao usuário autenticado
retornam `404`.

Requisições sem autenticação ou com JWT inválido retornam `401`.

------------------------------------------------------------------------

## 9. Seed

O projeto possui:

``` text
prisma/seed.js
```

O seed cria:

-   3 usuários;
-   3 transações para cada usuário;
-   senhas com bcrypt;
-   dados compatíveis com o schema atual.

Ele utiliza `upsert` para os usuários e recria as transações dos
usuários do seed, permitindo repetir o processo sem acumular duplicatas.

Credenciais de desenvolvimento definidas pelo seed:

``` text
Senha: fintech-dev-123
```

Os usuários criados são:

``` text
dev.alice
dev.bruno
dev.carol
```

------------------------------------------------------------------------

## 10. Testes de integração

O projeto possui:

``` text
src/server.test.js
```

Os testes verificam, entre outros pontos:

-   acesso sem JWT;
-   JWT inválido;
-   JWT expirado;
-   cadastro;
-   login;
-   `/auth/me`;
-   listagem de transações;
-   validação de transação;
-   criação;
-   atualização;
-   exclusão;
-   isolamento entre usuários;
-   logout.

Um ponto importante é o teste de autorização: o segundo usuário tenta
alterar e excluir uma transação pertencente ao primeiro e recebe `404`.

------------------------------------------------------------------------

## 11. Variáveis de ambiente

O backend depende de:

``` env
DATABASE_URL=...
JWT_SECRET=...
PORT=...
```

Os valores reais devem permanecer no `.env` e não devem ser versionados
publicamente.

------------------------------------------------------------------------

## 12. Fluxo completo

``` text
POST /auth/login
       │
       ▼
authRoutes
       │
       ▼
authController
       │
       ├── Prisma → PostgreSQL
       │
       ├── bcrypt → valida senha
       │
       └── jsonwebtoken → gera JWT
                    │
                    ▼
              token + user
                    │
                    ▼
              Frontend React
                    │
       Authorization: Bearer JWT
                    │
                    ▼
            requireAuth
                    │
                    ▼
          transactionRoutes
                    │
                    ▼
       transactionController
                    │
                    ▼
                 Prisma
                    │
                    ▼
              PostgreSQL
```

## 13. Checklist atual

-   [x] PostgreSQL configurado.
-   [x] Prisma configurado.
-   [x] SQLite removido da implementação.
-   [x] `better-sqlite3` removido.
-   [x] Modelos `User` e `Transaction`.
-   [x] Relação entre usuário e transação.
-   [x] Routes separadas.
-   [x] Controllers separados.
-   [x] Middleware JWT.
-   [x] Login com JWT.
-   [x] Cadastro com JWT.
-   [x] Endpoints de transações protegidos.
-   [x] Isolamento das transações por usuário.
-   [x] Seed com 3 usuários e 3 transações por usuário.
-   [x] Testes de autenticação e CRUD.
