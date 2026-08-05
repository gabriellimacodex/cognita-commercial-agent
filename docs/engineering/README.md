# Cognita Engineering Framework

## Finalidade

Este diretório contém a governança oficial de engenharia da Cognita. Cada conceito possui uma fonte canônica e deve ser referenciado, não copiado, por Skills, planos, ADRs e Pull Requests.

## Mapa documental

| Necessidade | Fonte canônica |
|---|---|
| Princípios e autoridade | [Constituição](constitution.md) |
| Termos normativos | [Glossário](glossary.md) |
| Obrigações técnicas | [Padrões](standards) |
| Forma preferida de trabalho | [Convenções](conventions) |
| Sequência operacional | [Workflows](workflows) |
| Verificação de conformidade | [Checklists](checklists) |
| Estrutura de documentos | [Templates](templates) |
| Decisões arquiteturais | [ADRs](../adr/README.md) |

## Como selecionar documentos

- Para qualquer mudança, ler `constitution.md` e `workflows/change-lifecycle.md`.
- Para planejamento, usar `checklists/planning.md` e `templates/change-plan.md`.
- Para arquitetura, consultar `standards/architecture.md` e o catálogo de ADRs.
- Para código, consultar `standards/code-quality.md` e as convenções aplicáveis.
- Para dados, consultar `standards/data-and-migrations.md` e `checklists/database-change.md`.
- Para segurança, consultar `standards/security.md`, `standards/configuration-and-secrets.md` e `checklists/security.md`.
- Para revisão, seguir `workflows/code-review.md` e os checklists de self-review e reviewer.
- Para PR, seguir `workflows/pull-request.md` e `.github/PULL_REQUEST_TEMPLATE.md`.

## Política de fonte única

- Constituição define princípios, não procedimentos detalhados.
- Standards definem obrigações, não sequências operacionais.
- Conventions definem a forma preferida, sem reduzir obrigações.
- Workflows definem ordem, papéis e gates.
- Checklists validam execução e não criam novas regras.
- Templates estruturam evidências e apontam para as regras aplicáveis.
- ADRs registram decisões específicas e não substituem manuais operacionais.

## Manutenção

Toda mudança normativa deve identificar os documentos afetados, evitar conteúdo duplicado e respeitar a hierarquia definida no `AGENTS.md`. Mudanças constitucionais exigem ADR e aprovação humana explícita.
