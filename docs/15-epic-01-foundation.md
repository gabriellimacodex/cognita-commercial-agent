# Épico 01 — Fundação

## Objetivo

Criar a fundação técnica do Cognita Commercial Agent sem implementar ainda a lógica de IA ou integrações reais.

## Entregáveis

1. Monorepo TypeScript.
2. API com health check.
3. Worker com health check.
4. Cockpit Next.js com página de status.
5. PostgreSQL.
6. Redis.
7. n8n self-hosted.
8. Docker Compose.
9. Migrations iniciais.
10. Logging estruturado.
11. Configuração de ambiente.
12. Lint, typecheck e testes.
13. README de execução local.

## Critérios de aceite

- `docker compose up` sobe todos os serviços.
- API responde em `/health`.
- Worker conecta ao Redis.
- API conecta ao PostgreSQL.
- Cockpit exibe status dos serviços.
- n8n abre localmente.
- Nenhum segredo real está versionado.
- Testes básicos passam.

## Restrições

- Não implementar WhatsApp.
- Não implementar CRM.
- Não implementar IA.
- Não implementar regras comerciais além de interfaces vazias.
- Não criar workflow monolítico.

## Prompt inicial para o Codex

Leia `AGENTS.md` e todos os arquivos em `docs/`.

Antes de escrever código, produza um plano de implementação do Épico 01 contendo:

- arquitetura proposta;
- ferramentas e versões;
- arquivos a criar;
- serviços Docker;
- variáveis de ambiente;
- riscos;
- testes;
- ordem de execução.

Não implemente ainda. Aguarde uma revisão do plano.
