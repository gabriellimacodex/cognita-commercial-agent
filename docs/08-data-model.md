# Modelo de Dados Inicial

## Entidades

- organizations
- users
- agents
- companies
- contacts
- leads
- opportunities
- conversations
- messages
- qualifications
- decisions
- actions
- follow_ups
- meetings
- handoffs
- prompts
- policies
- tools
- events
- evaluations
- incidents

## Regras

- IDs devem ser UUID.
- Toda entidade crítica deve ter created_at e updated_at.
- Eventos devem ser imutáveis.
- Mensagens externas devem ter external_id.
- Ações externas devem ter idempotency_key.
- Dados de IA devem registrar model, prompt_version, latency e confidence.
