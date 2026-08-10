# Cognita Commercial Agent

Fundação técnica do Cognita Commercial Agent. O Épico 01 comprova, sem lógica
comercial, a persistência e o processamento assíncrono de um job técnico
SHA-256.

Leia `AGENTS.md` antes de modificar o repositório. Decisões estruturais da
fundação estão registradas nas ADRs 005, 006 e 007.

## Vertical slice da fundação

O fluxo executável é:

`Cockpit → API → PostgreSQL → BullMQ/Redis → Worker → PostgreSQL → API → Cockpit`

O PostgreSQL é a fonte de verdade. Redis e BullMQ são transporte e coordenação.
O cockpit pode recarregar um job pelo identificador armazenado na URL e consulta
novamente o estado persistido.

## Estrutura implementada

- `apps/api`: rotas Fastify, handlers HTTP e serviços de aplicação.
- `apps/worker`: consumer BullMQ, operação técnica e recovery estreito.
- `apps/cockpit`: interface Next.js para executar e observar o vertical slice.
- `packages/database`: Kysely, acesso ao PostgreSQL e migrations explícitas.
- `packages/schemas`: contratos Zod compartilhados.
- `packages/observability`: configuração canônica de logs Pino com redaction.
- `infrastructure/docker`: imagens non-root das aplicações.
- `tests`: integração real e E2E do cockpit.
- `tools/governance`: tooling isolado do Cognita Engineering Framework.

Não existem packages comerciais, de IA ou de integrações neste épico. A tabela
`organizations` é apenas preparação estrutural e não implementa isolamento,
autorização ou multi-tenancy.

## Toolchain exata

- Node.js `24.19.0`
- pnpm `11.21.0`
- Docker Compose `5.1.0`

As demais versões diretas são exatas em `package.json` e
`pnpm-lock.yaml`. Imagens usam tag e digest imutável.

## Execução local

Instale dependências e valide o workspace:

```sh
pnpm install --frozen-lockfile
pnpm peers check
pnpm foundation:check
```

Suba a fundação completa:

```sh
docker compose up -d --build --wait
```

Serviços publicados apenas em loopback:

- cockpit: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:3001`
- n8n: `http://127.0.0.1:5678`

O health do worker existe somente na rede interna. PostgreSQL e Redis não são
publicados pelo Compose base. Para desenvolvimento local, o override publica
PostgreSQL em `127.0.0.1:5433` e Redis em `127.0.0.1:6380`:

```sh
docker compose -f compose.yaml -f compose.dev.yaml up -d --wait postgres redis
```

## Migrations e testes

Com o override de desenvolvimento ativo e `DATABASE_URL` definido:

```sh
pnpm db:migrate
pnpm db:migrate:down
pnpm db:migrate
```

Os comandos de validação são:

```sh
pnpm lint
pnpm typecheck
pnpm build
pnpm test:unit
pnpm test:integration
pnpm test:e2e
```

Os testes de integração exigem PostgreSQL e Redis locais. O E2E exige a
fundação completa saudável. `Foundation CI` executa o mesmo conjunto, incluindo
migrations reversíveis, falhas de transporte, vertical slice, cockpit, restart
do n8n e shutdown do worker.

## Limites operacionais

- Os endpoints não possuem autenticação e só podem operar localmente.
- O n8n usa SQLite e volume próprios, sem workflow e sem acesso aos dados da
  aplicação.
- AOF do Redis é opcional no override de desenvolvimento e não fornece a
  garantia de durabilidade do job.
- Não existe deploy externo autorizado no Épico 01.
