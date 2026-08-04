# Cognita Commercial Agent

Repositório-base para o SDR digital da Cognita.

## Princípio central

- O código decide.
- O n8n executa.
- O PostgreSQL registra.
- O operador supervisiona.

## Objetivo do primeiro marco

Entregar um corte vertical funcional: lead inbound → classificação → resposta sugerida → aprovação humana → envio → auditoria.

## Estrutura

- `apps/api`: API principal e domínio comercial.
- `apps/cockpit`: painel operacional.
- `apps/worker`: processamento assíncrono.
- `packages/database`: schema, migrations e acesso a dados.
- `packages/commercial-engine`: estados, regras e decisões comerciais.
- `packages/ai-engine`: integração com modelos e validação de saídas.
- `packages/integrations`: adaptadores externos.
- `packages/schemas`: contratos compartilhados.
- `packages/observability`: logs, métricas e tracing.
- `n8n/workflows`: workflows versionados.
- `docs`: documentação de produto, arquitetura e operação.

## Ordem inicial de execução

1. Ler `AGENTS.md`.
2. Ler `docs/00-product-vision.md`.
3. Ler `docs/01-icp.md`.
4. Ler `docs/07-architecture.md`.
5. Executar `docs/15-epic-01-foundation.md`.
