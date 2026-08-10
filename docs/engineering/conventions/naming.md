# Convenção de Nomes

## Princípios

- Escolher nomes que expressem responsabilidade e comportamento.
- Usar vocabulário definido no domínio e no glossário.
- Evitar abreviações não reconhecidas e nomes genéricos como `utils`, `helper`, `manager` ou `data` sem qualificador.

## Código e arquivos

- TypeScript: `camelCase` para valores e funções; `PascalCase` para tipos, classes e componentes.
- Constantes globais realmente imutáveis: `UPPER_SNAKE_CASE`.
- Arquivos de código: `kebab-case` salvo exigência do framework.
- Testes: nome do artefato seguido de `.test` ou `.spec`, conforme a camada definida no projeto.
- Variáveis de ambiente: `UPPER_SNAKE_CASE`.

## Banco

- Tabelas e colunas: `snake_case`.
- Tabelas no plural.
- Chaves primárias: `id`.
- Chaves estrangeiras: `<entidade>_id`.
- Índices e constraints devem indicar tabela, campos e finalidade de forma legível.

## Documentação

- Arquivos: `kebab-case.md`.
- ADRs: `NNN-short-decision-title.md`.
- Títulos devem descrever o assunto sem repetir a categoria do diretório.
