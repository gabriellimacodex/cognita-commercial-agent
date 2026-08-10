# ADR 005 — Adotar a baseline tecnológica da fundação

- **Status:** Accepted
- **Data:** 2026-08-10
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** ADR 007 (substituição parcial limitada à versão do ESLint)

## Contexto

O Épico 01 precisa criar a primeira implementação técnica do Cognita
Commercial Agent por meio de um vertical slice sem comportamento comercial. O
repositório já possui o Cognita Engineering Framework, o check obrigatório
`CEF Governance` e o Ruleset de `main`, mas ainda não possui monorepo de
produto, aplicações executáveis, banco da aplicação, fila, Docker Compose ou
runtime do produto.

As escolhas de runtime, workspace, frameworks, persistência, fila,
observabilidade e automação são estruturais segundo o padrão de dependências.
Elas não podem ser inferidas do runtime isolado de `tools/governance` nem
implementadas antes de uma ADR aceita.

O plano reconciliado do Épico 01 foi aprovado somente para formalização
arquitetural. Esta proposta não autoriza implementação.

## Problema

Qual baseline tecnológica deve sustentar o Épico 01 de forma reproduzível,
simples e compatível com o CEF, sem antecipar módulos comerciais, acoplar o
tooling de governança ao produto ou transformar decisões temporárias de
desenvolvimento local em arquitetura permanente?

## Restrições

- O vertical slice deve ser estritamente técnico e não pode introduzir lógica,
  entidades ou infraestrutura comercial.
- O monorepo deve usar `apps/api`, `apps/worker` e `apps/cockpit`.
- Somente `packages/database`, `packages/schemas` e
  `packages/observability` possuem consumidores concretos neste épico.
- Não criar package, diretório, interface ou abstração para uso hipotético.
- Não usar Turborepo neste épico.
- Dependências diretas devem usar versões exatas e lockfile versionado.
- Imagens devem usar tag exata e digest imutável.
- O tooling npm em `tools/governance` deve permanecer isolado do workspace pnpm
  do produto.
- `CEF Governance` permanece inalterado e como único required check do
  Ruleset.
- `Foundation CI` pode ser criado como check adicional não obrigatório no
  Ruleset.
- Os endpoints técnicos sem autenticação são permitidos somente em loopback,
  sem deploy externo ou exposição pública.
- n8n deve persistir sua configuração em SQLite e volume próprios, sem acesso
  aos dados da aplicação.
- A tabela `organizations` é apenas preparação estrutural e não implementa
  multi-tenancy.
- Nenhuma decisão desta ADR autoriza deploy em produção.

## Alternativas consideradas

### Usar npm workspaces para produto e governança

Reduziria o número de package managers, mas acoplaria o ciclo de dependências do
produto ao tooling de governança que a ADR 004 tornou deliberadamente isolado.
Rejeitada para preservar fontes de dependência e lockfiles independentes.

### Usar pnpm workspaces sem orquestrador adicional

Oferece workspace eficiente, resolução estrita, protocolo `workspace:` e
execução topológica suficiente para três aplicações e três packages.
Selecionada por atender ao épico sem introduzir cache distribuído ou outra
camada de build.

### Adicionar Turborepo desde a fundação

Poderia oferecer cache e pipeline declarativo, mas ainda não existe escala de
build que justifique a dependência e sua configuração. Rejeitada por criar
infraestrutura sem necessidade comprovada.

### Unificar API, worker e cockpit em Next.js

Diminuiria a quantidade de projetos, porém misturaria processo web, consumidor
assíncrono e interface, dificultando health, shutdown e limites operacionais.
Rejeitada em favor de aplicações executáveis separadas.

### Usar NestJS para API e worker

Forneceria estrutura abrangente e injeção de dependências, mas adicionaria
cerimônia e abstrações além do necessário para duas rotas e uma fila técnica.
Rejeitada em favor de Fastify e módulos explícitos.

### Usar Prisma ou Drizzle como camada de dados

Ambas oferecem ecossistema e tipagem. Prisma adiciona geração e runtime mais
amplos que o necessário; Drizzle não oferece a mesma estratégia direta de
reversão para as migrations propostas. Rejeitadas neste épico em favor de
Kysely com `pg`, queries tipadas e migrations de SQL explícito com `up` e
`down`.

### Usar apenas `pg` e criar um migration runner próprio

Reduziria uma dependência, mas exigiria construir coordenação, locking e
histórico de migrations. Rejeitada porque recriaria infraestrutura já
disponível no migrator de Kysely.

### Usar TypeScript 7.0.2

É a versão mais recente consultada durante o planejamento, mas o toolchain de
lint selecionado ainda declara compatibilidade abaixo de TypeScript 6.1.
Rejeitada nesta baseline em favor de TypeScript 5.9.3, reduzindo risco de
incompatibilidade sem flexibilizar versões.

### Persistir n8n no PostgreSQL da aplicação

Centralizaria armazenamento, mas daria ao n8n acesso à infraestrutura de dados
da aplicação e confundiria ownership. Rejeitada em favor de SQLite e volume
isolados durante o Épico 01.

### Exigir Docker Compose 5.4.0

Atualizaria o ambiente para a release disponível mais recente, mas nenhum
recurso planejado exige essa versão. O Compose 5.1.0 instalado validou
healthchecks, dependências condicionais, serviço one-shot, redes, volumes,
loopback e porta interna. Rejeitada por não haver incompatibilidade concreta.

### Criar todos os packages previstos pela arquitetura comercial

Anteciparia fronteiras sem implementação ou consumidor e contrariaria o padrão
de arquitetura. Rejeitada; novos packages dependerão de responsabilidade real,
plano e decisão aplicável.

## Decisão

Adotar a seguinte baseline.

### Decisões estruturais

- Node.js como runtime do produto.
- pnpm workspaces como gerenciador e workspace, separado do npm de
  `tools/governance`.
- TypeScript em modo estrito.
- Fastify para a API e health interno do worker.
- Next.js e React para o cockpit.
- PostgreSQL como armazenamento autoritativo da aplicação.
- Kysely com `pg` para queries tipadas e migrations explícitas.
- Redis e BullMQ para transporte e coordenação assíncrona, sem autoridade sobre
  o estado do domínio.
- Zod para contratos e configuração nas fronteiras.
- Pino para logs estruturados com redaction.
- Docker Compose para integração local e testes da fundação.
- n8n self-hosted como processo separado.

As regras de entrega durável entre PostgreSQL e BullMQ pertencem à ADR 006 e
não são redefinidas aqui.

### Aplicações e packages do Épico 01

Criar somente:

- `apps/api`;
- `apps/worker`;
- `apps/cockpit`;
- `packages/database`;
- `packages/schemas`;
- `packages/observability`.

Não criar `commercial-engine`, `ai-engine`, `integrations`, package genérico de
filas, event bus, orchestrator ou package vazio. A ausência de Turborepo é
deliberada.

### Versões exatas

| Componente | Versão |
|---|---|
| Node.js | `24.19.0` |
| pnpm | `11.21.0` |
| TypeScript | `5.9.3` |
| Fastify | `5.11.3` |
| Next.js | `16.3.0` |
| React | `19.2.8` |
| React DOM | `19.2.8` |
| PostgreSQL | `18.4` |
| Kysely | `0.29.5` |
| pg | `8.23.0` |
| Redis | `8.10.0` |
| BullMQ | `6.0.10` |
| ioredis | `6.0.0` |
| Zod | `4.4.3` |
| Pino | `10.3.1` |
| pino-pretty | `13.1.3` |
| n8n | `2.33.7` |
| Vitest | `4.1.10` |
| Playwright | `1.62.1` |
| ESLint | `10.8.1` |
| typescript-eslint | `8.66.0` |
| eslint-config-next | `16.3.0` |
| Prettier | `3.9.6` |
| tsx | `4.23.12` |

Dependências complementares diretas também deverão ser fixadas no manifesto e
no lockfile. Ranges transitivos pertencem ao lockfile gerado pelo pnpm.

### Imagens fixadas

| Uso | Referência |
|---|---|
| Aplicações Node.js | `node:24.19.0-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03` |
| PostgreSQL | `postgres:18.4-bookworm@sha256:882236b897e39051d2368c5ccc6cda944904723506b2dfc97f2a8f5bc9afa382` |
| Redis | `redis:8.10.0-trixie@sha256:344e3945a0b431c8ff1eecd58c5573538126bd756f02fc7e218ddf1fc2546366` |
| n8n | `n8nio/n8n:2.33.7@sha256:3989d9b8ebb77b4ee8f604519eb73e44f4384bfaa689526e0104eed79a237d30` |

### Docker Compose

Manter Docker Compose 5.1.0 como baseline operacional verificada. Os recursos
planejados foram aceitos por `docker compose config --quiet` nessa versão sem
criar serviços. Versão superior só poderá ser exigida diante de recurso
concreto incompatível, documentado e autorizado.

PostgreSQL e Redis permanecerão apenas na rede interna no Compose base. Um
override de desenvolvimento poderá publicar PostgreSQL em
`127.0.0.1:5433` e Redis em `127.0.0.1:6380`. API, cockpit e n8n serão ligados
somente a loopback; o health do worker ficará exclusivamente na rede interna.

O n8n usará uma rede de status compartilhada apenas com o cockpit, SQLite em
seu volume próprio e nenhuma conexão com PostgreSQL ou Redis da aplicação.

### Decisões específicas e temporárias do Épico 01

- n8n com SQLite e volume isolados é específico deste épico; mudança de
  armazenamento exige reavaliação arquitetural.
- Endpoints técnicos sem autenticação são temporariamente permitidos somente
  em loopback, sem deploy externo e sem exposição pública.
- `Foundation CI` será um check separado, mas não será required check do
  Ruleset nesta adoção.
- Redis AOF será opcional em desenvolvimento e não será garantia de
  durabilidade.

Exposição externa, produção, autenticação, autorização ou alteração do Ruleset
não são autorizadas por esta ADR.

### Decisões explicitamente adiadas

Multi-tenancy permanece não resolvido. A tabela `organizations` será apenas
preparação estrutural e não implementará tenant resolution, tenant isolation,
autorização, Row-Level Security ou qualquer garantia de segurança entre
organizações.

Também ficam adiados packages comerciais, integrações reais, IA, estratégia de
deploy, observabilidade distribuída e escala horizontal de produção.

### Política de atualização

- Fixar dependências diretas e package manager em versões exatas.
- Versionar `pnpm-lock.yaml` e instalar com lockfile congelado no CI.
- Fixar imagens por tag e digest.
- Atualizações de patch ou digest exigem plano, audit e testes proporcionais.
- Major version, troca de framework, runtime, banco, fila, query builder,
  plataforma de observabilidade ou isolamento exigem análise de compatibilidade
  e podem exigir ADR sucessora.
- Remover dependência sem consumidor.

### Relação com o CI e a governança

`CEF Governance` continua inalterado e obrigatório conforme a ADR 004.
`Foundation CI` poderá executar lint, typecheck, build e testes do produto, mas
não integrará o Ruleset nesta decisão. Torná-lo required check exige o processo
de mudança definido pela ADR 004, incluindo decisão arquitetural sucessora
quando aplicável.

## Consequências positivas

- O produto ganha runtime e dependências reproduzíveis sem acoplar o CEF.
- As aplicações possuem responsabilidades operacionais separadas.
- O workspace permanece simples e dispensa orquestrador de build prematuro.
- Packages compartilhados possuem consumidores reais desde a fundação.
- PostgreSQL, Redis e n8n possuem ownership e redes explícitos.
- O ambiente local atual não exige upgrade sem benefício demonstrado.
- A fundação pode provar o vertical slice sem introduzir domínio comercial.

## Consequências negativas

- O repositório passa a manter npm para governança e pnpm para produto.
- API, worker e cockpit exigem builds e imagens separados.
- Kysely mantém SQL e tipos próximos do código, exigindo disciplina de migration
  e schema.
- n8n com SQLite não representa topologia de produção ou alta disponibilidade.
- Endpoints sem autenticação impedem qualquer deploy externo.
- Versões e digests fixos exigem atualização deliberada para receber correções.
- `Foundation CI` não terá enforcement automático pelo Ruleset nesta fase.

## Riscos

- **Drift entre manifests e lockfile:** mitigar com instalação congelada e CI.
- **Vulnerabilidade em dependência ou imagem:** mitigar com audit, revisão de
  imagem, atualização deliberada e rollback para versão verificada.
- **Confusão entre runtimes do CEF e produto:** mitigar com workspaces e
  lockfiles separados.
- **Exposição acidental de endpoint sem autenticação:** mitigar com loopback,
  ausência de deploy e teste da configuração de portas.
- **n8n alcançar dados da aplicação:** mitigar com redes distintas e ausência de
  credenciais da aplicação.
- **SQLite do n8n ser tratado como produção:** mitigar documentando seu caráter
  específico e temporário.
- **Packages vazios ou abstrações hipotéticas:** mitigar com validação de
  consumidores e escopo explícito.
- **Multi-tenancy presumido pela presença de `organizations`:** mitigar com
  documentação, ausência de claims de isolamento e ADR futura obrigatória.
- **Check de produto falhar sem bloqueio do Ruleset:** mitigar pelo gate humano
  do modo `Single Maintainer`; enforcement futuro segue a ADR 004.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-10. A aceitação
precede qualquer manifesto, código, migration, Dockerfile, Compose, workflow de
produto ou aplicação do Épico 01.

Depois da aceitação:

1. partir de `main` atualizada;
2. criar manifests e lockfile separados do tooling de governança;
3. implementar somente as aplicações e packages autorizados;
4. validar Compose 5.1.0, imagens e execução non-root;
5. criar `Foundation CI` sem mudar o Ruleset;
6. demonstrar o vertical slice e os critérios do plano aprovado;
7. manter o modo `Single Maintainer`.

## Reversão

Antes da aceitação, a ADR podia ser revisada ou rejeitada sem efeito sobre o
produto porque nenhuma implementação estava autorizada.

Depois de aceita e adotada, mudança estrutural deve usar ADR sucessora e plano
de migração. Antes de existir dado persistido, o bootstrap pode ser revertido
removendo os artefatos do Épico 01 por Pull Request. Depois de existir dado, a
reversão de aplicação deve preservar PostgreSQL e volumes; remoção destrutiva
exige autorização específica, backup e procedimento próprio.

Alteração do Ruleset segue exclusivamente a ADR 004 e não faz parte do rollback
desta decisão.

## Referências

- `AGENTS.md`
- `docs/15-epic-01-foundation.md`
- `docs/adr/003-single-maintainer-governance.md`
- `docs/adr/004-repository-governance-bootstrap.md`
- `docs/adr/006-durable-foundation-job-delivery.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/dependencies.md`
- `docs/engineering/standards/configuration-and-secrets.md`
- `docs/engineering/standards/security.md`
