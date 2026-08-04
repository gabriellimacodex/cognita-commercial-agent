# Arquitetura

## Visão

Canal → n8n → API → motor comercial → fila → n8n → sistema externo → confirmação → auditoria.

## Componentes

### API

Recebe eventos, gerencia domínio, valida comandos e expõe cockpit.

### Worker

Executa tarefas assíncronas, sumarização, classificação e reconciliação.

### Commercial Engine

Estados, regras, score, próxima melhor ação e permissões.

### AI Engine

Abstração de modelos, prompts versionados, schemas e fallback.

### n8n

Integrações e execução de comandos externos.

### PostgreSQL

Fonte de verdade.

### Redis/BullMQ

Filas, retries e processamento assíncrono.

## Requisitos não funcionais

- idempotência;
- auditabilidade;
- isolamento por organização;
- logs estruturados;
- segurança de secrets;
- backups;
- staging e produção separados.
