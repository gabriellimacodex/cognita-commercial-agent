# Contratos de API

## Contratos locais implementados

Os contratos executáveis são definidos e validados em
`../packages/schemas/src/commercial.ts`. A semântica decisória é canônica nas
[ADRs 010 e 011](adr/README.md).

O Épico 03 acrescenta os seguintes endpoints locais:

- `POST /commercial/leads/:id/facts`: registra um Fact imutável; requer
  `Idempotency-Key`.
- `GET /commercial/leads/:id/facts`: retorna o snapshot ativo determinístico.
- `POST /commercial/leads/:id/decisions`: avalia uma única ação e persiste o
  Decision Record; requer `Idempotency-Key`.
- `GET /commercial/decisions/:id`: consulta um Decision Record.
- `GET /commercial/leads/:id/decision-context`: consulta Lead, Opportunity,
  Facts ativos e a Decision mais recente.

`POST /commercial/opportunities` e
`POST /commercial/opportunities/:id/transitions` exigem uma Decision aplicável,
atual e ainda não utilizada. Os endpoints permanecem sem autenticação e são
autorizados somente no ambiente local delimitado pelas ADRs 008 e 011.

## Contratos futuros não implementados

Os contratos abaixo permanecem rascunhos de produto e não descrevem rotas
disponíveis:

## POST /v1/events/inbound-message

Recebe uma mensagem normalizada.

## POST /v1/actions/:id/execute

Autoriza execução de uma ação previamente criada.

## POST /v1/actions/:id/result

Recebe confirmação do n8n.

## GET /v1/leads/:id

Retorna visão consolidada do lead.

## POST /v1/leads/:id/handoff

Transfere para humano.

## POST /v1/leads/:id/pause

Pausa autonomia.

## POST /v1/leads/:id/resume

Retoma autonomia.
