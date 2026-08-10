# ADR 007 — ESLint Compatibility Baseline for Next.js 16

- **Status:** Accepted
- **Data:** 2026-08-10
- **Responsável:** Cognita
- **Substitui:** ADR 005 (somente a baseline de versão do ESLint)
- **Substituída por:** nenhuma

## Contexto

A ADR 005 adotou uma baseline exata para a fundação, incluindo ESLint 10.8.1,
`eslint-config-next` 16.3.0, TypeScript 5.9.3 e `typescript-eslint`
8.66.0. Durante o início controlado do Épico 01, a instalação e a execução
real do lint demonstraram que a cadeia transitiva do `eslint-config-next`
16.3.0 ainda não é compatível com ESLint 10.8.1.

A implementação foi interrompida quando a incompatibilidade material foi
confirmada. Esta ADR registra uma correção mínima da baseline antes da
continuidade do épico. A implementação permaneceu interrompida até a decisão
humana explícita registrada nesta ADR.

Esta ADR sucede parcialmente a ADR 005. Sua precedência é restrita à versão do
ESLint: todas as demais decisões, versões, limites e consequências da ADR 005
permanecem válidas. A ADR 006 não é alterada.

## Problema

Qual versão única do ESLint deve compor a baseline da fundação para manter
`eslint-config-next` 16.3.0 ativo, preservar o restante da cadeia aprovada e
executar o lint de forma reproduzível sem ignorar incompatibilidades de peer
dependencies?

## Restrições

- Alterar somente a versão direta do ESLint definida na ADR 005.
- Preservar `eslint-config-next` 16.3.0, TypeScript 5.9.3 e
  `typescript-eslint` 8.66.0.
- Preservar todas as demais decisões da ADR 005 e toda a ADR 006.
- Manter uma única versão direta do ESLint no workspace do produto.
- Não forçar ESLint 10.8.1 por override, instalação permissiva ou supressão de
  peer dependencies.
- Manter as regras do `eslint-config-next` ativas para o cockpit Next.js.
- Fixar a dependência direta em versão exata e registrá-la no lockfile quando
  esta proposta for aceita e adotada.
- Não retomar o Épico 01 enquanto esta ADR não receber decisão humana
  explícita.

## Evidência reproduzível

Um projeto temporário isolado reproduziu a baseline com pnpm 11.21.0 e as
versões exatas da ADR 005. O comando `pnpm peers check` terminou com código 1 e
identificou ESLint 10.8.1 fora dos intervalos aceitos por:

- `eslint-plugin-import` 2.32.0, que declara suporte até ESLint 9;
- `eslint-plugin-jsx-a11y` 6.10.2, que declara suporte até ESLint 9;
- `eslint-plugin-react` 7.37.5, que declara suporte a ESLint 9 a partir de
  9.7, mas não a ESLint 10.

Com `eslint-config-next` carregado, a execução real do ESLint 10.8.1 terminou
com código 2 e o erro:

```text
TypeError: Error while loading rule 'react/display-name': contextOrFilename.getFilename is not a function
```

No mesmo teste isolado, a única alteração de dependência foi ESLint 10.8.1
para ESLint 9.39.5. `npm ls` confirmou uma única versão deduplicada do ESLint
para `eslint-config-next`, seus plugins e `typescript-eslint`. A execução do
lint sobre um arquivo TSX de uma aplicação Next.js terminou com código 0.

Não foi necessário alterar TypeScript 5.9.3, `typescript-eslint` 8.66.0,
`eslint-config-next` 16.3.0, Next.js 16.3.0, a composição das configurações ou
o código analisado para obter o resultado positivo.

## Alternativas consideradas

### Manter ESLint 10.8.1 ignorando peer dependencies

Preservaria literalmente a versão da ADR 005, mas transformaria alertas de
compatibilidade em risco aceito sem suporte declarado. A alternativa também
não resolve o erro real em `react/display-name`. Rejeitada porque instalação
bem-sucedida não equivale a execução compatível e não se deve forçar a cadeia
ignorando peers.

### Remover eslint-config-next

Permitiria usar ESLint 10.8.1 apenas com regras compatíveis, porém eliminaria a
configuração específica do framework selecionada para o cockpit e reduziria a
cobertura do lint sem necessidade funcional. Rejeitada porque altera uma
decisão adicional da ADR 005 e contorna, em vez de resolver, a
incompatibilidade.

### Usar ESLint 9 e ESLint 10 simultaneamente

Poderia separar o cockpit dos demais workspaces, mas criaria dois resultados
de lint, duas árvores de plugins e manutenção duplicada para a mesma
responsabilidade. Rejeitada por contrariar a simplicidade do workspace e o
padrão de dependências.

### Aguardar atualização futura do ecossistema

Evitaria alterar a baseline hoje, mas bloquearia o Épico 01 por prazo
indeterminado sem benefício para o escopo aprovado. Rejeitada porque existe
uma versão compatível, estável e comprovada da mesma ferramenta.

### Alterar outros componentes da baseline

Atualizar ou rebaixar Next.js, `eslint-config-next`, TypeScript ou
`typescript-eslint` poderia produzir outras combinações. Rejeitada porque a
evidência isola o problema na versão major do ESLint e não demonstrou
necessidade de mudar os demais componentes.

### Adotar ESLint 9.39.5 como versão única

Preserva as decisões do cockpit e do toolchain, satisfaz os intervalos de peer
dependencies observados e executa a configuração aprovada sem erro. É a
alternativa selecionada por ser a menor mudança comprovadamente suficiente.

## Decisão

Substituir exclusivamente a entrada de versão do ESLint na baseline da ADR
005:

| Componente | Baseline anterior | Nova baseline |
|---|---|---|
| ESLint | `10.8.1` | `9.39.5` |

ESLint 9.39.5 será a única versão direta do ESLint no workspace do produto.
`eslint-config-next` 16.3.0 continuará ativo. ESLint 10 não será instalado à
força, não terá peers ignorados e não coexistirá com ESLint 9.

Todas as demais decisões da ADR 005 permanecem válidas sem modificação,
inclusive TypeScript 5.9.3, `typescript-eslint` 8.66.0,
`eslint-config-next` 16.3.0, a separação do tooling de governança e as demais
versões tecnológicas. A ADR 006 permanece integralmente válida.

A baseline poderá ser revista quando a cadeia completa utilizada pelo Next.js
declarar suporte a ESLint 10 e a compatibilidade for comprovada por instalação,
peer check e execução real do lint. A mera disponibilidade de uma nova versão
não é evidência suficiente.

## Consequências positivas

- O lint do cockpit mantém as regras específicas do Next.js.
- A cadeia deixa de depender de peers declaradamente incompatíveis.
- Uma única versão do ESLint produz resultados consistentes no workspace.
- TypeScript, Next.js e as demais decisões aceitas não precisam ser alterados.
- O Épico 01 poderá continuar após aceitação humana desta ADR sem workaround de
  instalação.

## Consequências negativas

- A baseline permanece em ESLint 9 enquanto ESLint 10 já está disponível.
- Correções e recursos exclusivos do ESLint 10 não poderão ser adotados agora.
- A relação de precedência parcial exige consultar esta ADR junto da ADR 005
  para obter a versão vigente do ESLint.
- Uma futura migração para ESLint 10 exigirá nova verificação da cadeia
  transitiva e poderá demandar outra ADR sucessora.

## Riscos

- **Permanência excessiva em ESLint 9:** mitigar revisando a compatibilidade em
  atualizações deliberadas do Next.js e de seus plugins.
- **Upgrade prematuro por versão disponível:** mitigar exigindo peer check e
  execução real antes de qualquer mudança para ESLint 10.
- **Drift para duas versões:** mitigar com versão direta exata, lockfile e
  inspeção da árvore de dependências.
- **Interpretação de substituição total da ADR 005:** mitigar com escopo de
  precedência explícito nos campos de relacionamento e na decisão.
- **Vulnerabilidade futura no ESLint 9:** mitigar com auditoria, atualização de
  patch compatível e ADR sucessora se a correção exigir mudança estrutural.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-10. Sua aceitação
autoriza somente a alteração de baseline descrita nesta decisão e a retomada do
Épico 01 no escopo previamente aprovado.

Depois de aceita, sua adoção deverá ocorrer no fluxo já autorizado do Épico 01:

1. definir ESLint 9.39.5 como única dependência direta de ESLint;
2. manter `eslint-config-next` 16.3.0 e as demais versões da ADR 005;
3. atualizar o lockfile sem ignorar peer dependencies;
4. executar peer check, lint, typecheck, build e gates aplicáveis;
5. registrar na Pull Request a relação com as ADRs 005 e 007.

## Reversão

Antes da aceitação, rejeitar esta ADR não exigia reversão de produto, pois
nenhuma adoção estava autorizada.

Depois de aceita e adotada, a baseline somente deverá voltar ao ESLint 10 — ou
migrar para outra major — por ADR sucessora baseada em suporte declarado pela
cadeia completa, peer check sem incompatibilidades e execução real bem-sucedida
do lint. A reversão operacional deverá manter uma única versão direta e o
lockfile coerente; ignorar peers não é estratégia de rollback.

## Referências

- `docs/adr/005-foundation-technology-baseline.md`
- `docs/adr/006-durable-foundation-job-delivery.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/dependencies.md`
- `docs/engineering/standards/documentation.md`
- Evidência local reproduzível de `pnpm peers check` com pnpm 11.21.0
- Execução isolada do ESLint 10.8.1 e do ESLint 9.39.5 com a mesma cadeia
