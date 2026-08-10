# Architecture Decision Records

Este diretório é a fonte canônica das decisões arquiteturais do repositório.

## Numeração e nome

Usar numeração sequencial de três dígitos:

```text
NNN-short-decision-title.md
```

Consultar o maior número existente e reservar o próximo somente no Pull Request que cria a ADR. Não renumerar ADRs publicadas.

## Status

- `Proposed`: em avaliação; não autoriza implementação.
- `Accepted`: aprovada e vigente.
- `Rejected`: avaliada e não adotada.
- `Deprecated`: não recomendada para novos trabalhos, ainda presente no histórico.
- `Superseded`: substituída por outra ADR identificada.

## Quando criar

Criar ADR para decisões duráveis sobre framework, persistência, filas, autenticação, multi-tenancy, contrato público, infraestrutura, segurança, dependência estrutural, deploy ou exceção a padrão obrigatório.

Não criar ADR para detalhes locais facilmente reversíveis, preferência de estilo coberta por convenção ou descrição de implementação sem decisão alternativa relevante.

## Processo

Seguir [workflow de ADR](../engineering/workflows/adr-lifecycle.md) e usar [template oficial](../engineering/templates/adr.md).

Uma ADR `Accepted` não deve ser alterada materialmente. Criar nova ADR para substituir a decisão e atualizar os campos de relacionamento nos dois documentos.

## Índice

| ADR | Título | Status |
|---|---|---|
| [001](001-cognita-engineering-framework.md) | Adotar o Cognita Engineering Framework | Accepted |
| [002](002-repository-local-codex-skills.md) | Versionar Skills CEF no repositório | Accepted |
| [003](003-single-maintainer-governance.md) | Operar a governança com um único mantenedor | Accepted |
| [004](004-repository-governance-bootstrap.md) | Adotar o Repository Governance Bootstrap | Accepted |
| [005](005-foundation-technology-baseline.md) | Adotar a baseline tecnológica da fundação | Accepted |
| [006](006-durable-foundation-job-delivery.md) | Adotar entrega durável para jobs da fundação | Accepted |
| [007](007-eslint-compatibility-baseline-nextjs-16.md) | ESLint Compatibility Baseline for Next.js 16 | Accepted |
| [008](008-commercial-domain-model-and-lifecycle.md) | Adotar o modelo e o ciclo de vida do domínio comercial | Accepted |
| [009](009-commercial-audit-idempotency-and-external-identity.md) | Adotar auditoria, idempotência e identidade externa comercial | Accepted |
