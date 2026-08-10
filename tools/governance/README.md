# Repository Governance Tooling

## Finalidade

Este diretório materializa validações objetivas definidas pelo Cognita
Engineering Framework. A documentação em `docs/engineering` e as ADRs aceitas
continuam sendo as fontes normativas.

## Requisitos

- Node.js `24.19.0`;
- npm `11.17.0`;
- Git;
- GitHub CLI autenticado somente para `npm run verify:github`.

## Instalação reproduzível

A partir deste diretório:

```sh
npm ci --ignore-scripts --no-audit --no-fund --cache .cache/npm
```

O lockfile é obrigatório. Não usar `npm install` para validar uma revisão.

## Execução local

Executar o mesmo gate usado pelo GitHub Actions:

```sh
npm run check
```

Os validadores internos também podem ser executados individualmente pelos
scripts `check:*` do `package.json`. O status check externo permanece
`CEF Governance`, independentemente da organização interna.

## Configurações efetivas do GitHub

Depois que `.github/rulesets/main.json` existir e o Ruleset tiver sido criado,
executar:

```sh
npm run verify:github
```

Esse comando é somente leitura. Ele compara o Ruleset efetivo com o estado
versionado e verifica pin obrigatório por SHA, permissão padrão de leitura do
`GITHUB_TOKEN` e proibição de aprovação de Pull Requests por workflows.

## Limites

- Os scripts verificam estrutura e evidência objetiva; não decidem coerência
  semântica.
- A execução básica não usa secrets.
- Fixtures inválidas são geradas em diretórios temporários e não são
  versionadas.
- Falha não autoriza bypass. Aplicar o workflow emergencial quando cabível.

## Referências

- `../../docs/adr/004-repository-governance-bootstrap.md`
- `../../docs/engineering/workflows/pull-request.md`
- `../../docs/engineering/workflows/governance-bootstrap.md`
