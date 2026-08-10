# Requests for Comments

Este diretório preserva investigações arquiteturais e propostas conceituais que precisam de análise antes de se tornarem decisões normativas.

## Autoridade

Uma RFC não autoriza implementação, não substitui ADR e não cria obrigação tecnológica. Decisões duráveis decorrentes de uma RFC exigem ADR específica, plano aprovado e autorização humana explícita.

## Numeração e nome

Usar numeração sequencial de quatro dígitos:

```text
NNNN-short-title.md
```

Não renumerar RFCs publicadas.

## Status

- `Draft`: análise inicial incompleta.
- `In Review`: aberta para avaliação e contrapontos.
- `Final`: exploração encerrada e disposição registrada; não implica autorização de implementação.
- `Withdrawn`: retirada antes de conclusão.
- `Superseded`: substituída por outra RFC identificada.

## Relação com ADRs

- RFC investiga problema, hipótese, alternativas e limites.
- ADR registra decisão arquitetural autorizada e suas consequências.
- Uma RFC `Final` pode concluir que nenhuma implementação deve ocorrer.
- Implementação tecnológica baseada em RFC exige ADR posterior quando os critérios aplicáveis forem atendidos.

## Índice

| RFC | Título | Status | Disposição |
|---|---|---|---|
| [0001](0001-universal-orchestration-model.md) | Universal Orchestration Model | Final | Direção conceitual aceita; implementação não autorizada |
