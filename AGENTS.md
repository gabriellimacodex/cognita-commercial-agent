# AGENTS.md — Cognita Commercial Agent

## Missão

Construir um funcionário comercial digital confiável, auditável e mensurável para a operação da Cognita.

## Princípios obrigatórios

1. Código decide.
2. n8n executa integrações e ações externas.
3. PostgreSQL é a fonte de verdade.
4. Toda ação deve ser auditável.
5. Nenhuma regra crítica pode existir apenas no n8n.
6. Toda saída de IA deve ser estruturada e validada por schema.
7. Toda integração externa deve ser idempotente.
8. Nenhuma mensagem pode ser enviada sem verificar o estado atual do lead.
9. Nenhum segredo pode ser versionado.
10. Toda funcionalidade deve incluir testes e critérios de aceite.

## Stack padrão

- TypeScript
- Node.js
- Fastify ou NestJS
- PostgreSQL
- Redis
- BullMQ
- Next.js
- Zod
- Docker Compose
- n8n self-hosted

## Fronteira código x n8n

### Código

- memória do lead;
- estado comercial;
- qualificação;
- score;
- regras;
- próxima melhor ação;
- permissões;
- prompts;
- auditoria;
- deduplicação;
- métricas;
- controle de follow-up.

### n8n

- webhooks;
- envio de WhatsApp;
- agenda;
- CRM externo;
- e-mail;
- alertas;
- enriquecimento;
- sincronizações;
- retries de integrações.

## Regras de implementação

- Planejar antes de escrever código.
- Não expandir escopo sem necessidade.
- Preferir módulos pequenos e coesos.
- Criar migrations versionadas.
- Criar logs estruturados.
- Usar chaves de idempotência em comandos externos.
- Tratar falhas com retries seguros e dead-letter queue.
- Não acoplar o domínio a fornecedores externos.
- Não acoplar o sistema a um único modelo de IA.

## Definition of Done

Uma tarefa só está concluída quando:

- o código compila;
- lint passa;
- typecheck passa;
- testes passam;
- critérios de aceite estão cobertos;
- documentação foi atualizada;
- não há segredos expostos;
- há logs adequados;
- há tratamento de erro;
- a mudança respeita a arquitetura.
