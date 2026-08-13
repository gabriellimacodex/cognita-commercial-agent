# Cognita Commercial Agent

Fundação técnica e domínio comercial determinístico do Cognita Commercial
Agent. O Épico 01 comprova a entrega durável de um job técnico; os Épicos 02 e
03 acrescentam o domínio comercial, Facts auditáveis, policies versionadas e
Decision Records. O Épico 04 acrescenta interpretação sintética governada,
Candidates não autoritativos, Evidence determinística e confirmação humana.

Leia `AGENTS.md` antes de modificar o repositório. Decisões estruturais da
fundação estão registradas nas ADRs 005, 006 e 007. O domínio, o engine e a
fronteira de interpretação comerciais seguem as ADRs 008 a 015.

## Vertical slice da fundação

O fluxo executável é:

`Cockpit → API → PostgreSQL → BullMQ/Redis → Worker → PostgreSQL → API → Cockpit`

O PostgreSQL é a fonte de verdade. Redis e BullMQ são transporte e coordenação.
O cockpit pode recarregar um job pelo identificador armazenado na URL e consulta
novamente o estado persistido.

## Vertical slice comercial

O fluxo comercial local é síncrono e usa PostgreSQL como fonte de verdade:

`Cockpit → API → Facts → Decision → Opportunity/Commercial State → API → Cockpit`

O cockpit demonstra standard fit e revisão humana declarada. Facts, Decisions,
aplicações e Commercial Events permanecem auditáveis após recarregar a página.
`declared_human` não ignora integridade estrutural, conflito de Facts ou hard
exclusion.

## Vertical slice de inteligência comercial

O fluxo sintético e governado é:

`Message → Interpretation Run → Provider/Fake → Candidate → Evidence → revisão humana → Fact → Decision`

O provider nunca cria Fact, Decision, Authority ou estado comercial. O servidor
valida structured output, deriva offsets Unicode e digest da Evidence e persiste
Candidates como propostas não autoritativas. Somente uma confirmação humana
explícita cria um Fact. Question Candidates são projeções determinísticas e não
persistidas dos requirement IDs canônicos.

O Compose e o CI usam exclusivamente o fake provider. O adapter OpenAI aprovado
usa `gpt-5.6-terra`, Responses API, schema strict, `store=false`, nenhuma tool,
timeout de 20 segundos, zero retry e zero fallback. O rollout permanece
exclusivamente sintético; dados reais, PII e informações comerciais reais não
podem ser transmitidos ao provider.

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

Não existem packages genéricos de IA ou de integrações. O adapter de linguagem
permanece dentro do módulo comercial da API. A tabela `organizations` delimita
as relações locais, mas não implementa autenticação, autorização ou
multi-tenancy seguro.

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
- Não existe deploy externo autorizado.
- Não existem score, confidence, CRM, WhatsApp ou automação comercial externa.
- O uso do modelo externo é opt-in, sintético e local; a chave nunca pertence ao
  Compose, ao browser, ao repositório ou ao CI.
