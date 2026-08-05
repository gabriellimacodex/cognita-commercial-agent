# AGENTS.md — Cognita Engineering Framework

Este arquivo é o ponto de entrada obrigatório para qualquer agente que trabalhe neste repositório.

## Autoridade

Aplicar a seguinte ordem de precedência:

1. instruções explícitas e autorizadas da tarefa;
2. este `AGENTS.md`;
3. [Constituição da Engenharia](docs/engineering/constitution.md);
4. ADRs aceitas em [docs/adr](docs/adr/README.md);
5. [padrões obrigatórios](docs/engineering/standards);
6. [convenções](docs/engineering/conventions);
7. [workflows](docs/engineering/workflows);
8. checklists e templates aplicáveis.

Interromper o trabalho e solicitar decisão humana quando houver conflito material entre autoridades, escopo ambíguo, risco não autorizado ou ausência de decisão obrigatória.

## Leitura obrigatória

Antes de qualquer trabalho técnico:

1. Ler integralmente este arquivo.
2. Ler integralmente `docs/engineering/constitution.md`.
3. Consultar `docs/engineering/README.md` para selecionar os documentos aplicáveis.
4. Ler as ADRs aceitas relacionadas ao escopo.
5. Invocar as Skills CEF pertinentes em `.agents/skills`.
6. Ler os documentos de produto relacionados sem reinterpretar seu escopo.

## Execução

Seguir o [workflow do ciclo de mudança](docs/engineering/workflows/change-lifecycle.md) e os Standards selecionados pelo [índice do CEF](docs/engineering/README.md). Este portal não redefine suas normas.

## Skills oficiais

- `cognita-engineering`: orientar qualquer tarefa técnica pelo CEF.
- `cognita-plan-change`: planejar mudanças antes da implementação.
- `cognita-write-adr`: criar ou substituir decisões arquiteturais.
- `cognita-implement-change`: executar somente planos autorizados.
- `cognita-review-change`: revisar mudanças por risco e evidência.
- `cognita-prepare-pr`: preparar Pull Requests completos e verificáveis.

As Skills coordenam o processo e referenciam as fontes oficiais. Elas não substituem nem duplicam a documentação normativa.

## Estado atual do produto

A implementação do Cognita Commercial Agent permanece suspensa até autorização explícita posterior. Trabalhos no CEF não autorizam mudanças em API, banco, Docker, Redis, n8n, worker, cockpit, IA ou lógica comercial.
