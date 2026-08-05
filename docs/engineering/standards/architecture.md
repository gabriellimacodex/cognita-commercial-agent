# Padrão de Arquitetura

## Objetivo

Definir obrigações para manter limites claros, dependências controladas e soluções proporcionais ao problema aprovado.

## Requisitos

- Separar transporte, aplicação, domínio e infraestrutura quando essas responsabilidades existirem.
- Manter lógica de aplicação fora de rotas, controllers, jobs, comandos e componentes de interface.
- Fazer dependências apontarem para abstrações internas quando um fornecedor externo puder variar.
- Não criar pacote, camada, interface ou generalização sem consumidor concreto.
- Preservar uma fonte de verdade deliberada para cada estado persistente.
- Tratar concorrência, idempotência e consistência como decisões explícitas quando houver efeitos assíncronos ou externos.
- Definir limites transacionais e comportamentos de falha.
- Isolar detalhes de infraestrutura de contratos públicos e regras do domínio.
- Registrar por ADR decisões estruturais ou difíceis de reverter.

## Proibições

- Regra crítica somente em automação externa ou interface.
- Dependência circular entre módulos.
- Estado autoritativo mantido apenas em cache ou fila sem decisão explícita.
- Framework interno genérico criado para uso hipotético.
- Mudança arquitetural escondida em refactor ou chore.

## Evidência mínima

- Diagrama ou descrição de dependências quando a mudança afetar mais de um limite.
- Critérios de falha e recuperação.
- Testes nos limites de maior risco.
- ADR quando exigida pelo catálogo em `docs/adr/README.md`.
