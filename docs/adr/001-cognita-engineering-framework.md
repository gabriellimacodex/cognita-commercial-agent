# ADR 001 — Adotar o Cognita Engineering Framework

- **Status:** Accepted
- **Data:** 2026-08-05
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

O desenvolvimento do Cognita Commercial Agent exige governança consistente durante planejamento, implementação, revisão e evolução arquitetural. Regras distribuídas apenas em solicitações pontuais não oferecem fonte canônica, histórico ou critérios uniformes de aprovação.

## Problema

Definir uma governança versionada que oriente pessoas e agentes sem misturar princípios, decisões, procedimentos e templates nem antecipar funcionalidade do produto.

## Restrições

- Preservar a documentação de produto existente.
- Não implementar componentes do produto.
- Manter cada conceito em uma fonte canônica.
- Tornar o framework utilizável imediatamente pelo Codex e por revisores humanos.

## Alternativas consideradas

### Manter regras apenas no AGENTS.md

Rejeitada porque concentraria conteúdo extenso, reduziria descoberta progressiva e misturaria níveis de autoridade.

### Manter um manual único de engenharia

Rejeitada porque dificultaria revisão isolada, evolução e seleção de conteúdo aplicável.

### Adotar estrutura modular governada por Constituição

Selecionada por separar autoridade, padrões, convenções, workflows, checklists, templates e ADRs.

## Decisão

Adotar o Cognita Engineering Framework como governança oficial do repositório, com precedência definida no `AGENTS.md`, Constituição versionada, documentos modulares e Skills CEF para execução operacional.

## Consequências positivas

- Fonte canônica para cada conceito.
- Critérios uniformes para mudança e revisão.
- Decisões arquiteturais preservadas no histórico.
- Orientação consistente para Codex e pessoas.

## Consequências negativas

- Custo de manutenção documental.
- Maior disciplina exigida antes de mudanças materiais.
- Necessidade de resolver conflitos entre documentos antigos e governança nova.

## Riscos

- Duplicação entre documentos se a política de fonte única não for respeitada.
- Uso mecânico de checklists sem avaliação real de risco.
- Desatualização das Skills em relação aos documentos canônicos.

## Adoção

Criar a estrutura aprovada do CEF, direcionar o `AGENTS.md` para ela e exigir seu uso em mudanças futuras.

## Reversão

Uma reversão exige nova ADR, pois remover o CEF altera a governança oficial do repositório.

## Referências

- `AGENTS.md`
- `docs/engineering/constitution.md`
