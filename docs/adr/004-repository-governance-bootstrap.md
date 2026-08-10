# ADR 004 — Adotar o Repository Governance Bootstrap

- **Status:** Accepted
- **Data:** 2026-08-10
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

O Cognita Engineering Framework está vigente na branch `main` e opera no modo
`Single Maintainer`, conforme a Constituição 1.1.0 e a ADR 003. Seus gates são
documentados e aplicados por Pull Request, self-review e evidências locais, mas
o repositório ainda não possui CI, Ruleset ou branch protection configurados.

Essa condição permite operar o CEF sem aprovações fictícias, porém deixa a
execução das validações dependente de disciplina manual e não impede, por
mecanismo do GitHub, push direto, force push, exclusão da branch principal ou
merge com validações ausentes.

O bootstrap precisa transformar obrigações já aprovadas em controles
reproduzíveis e verificáveis sem alterar o modo de governança, antecipar o
produto ou eliminar a capacidade auditável de recuperação quando um controle
falhar.

## Problema

Como automatizar as validações mínimas do CEF e proteger a branch `main` de
forma compatível com um único mantenedor, preservando privilégio mínimo,
reprodutibilidade local, auditabilidade e recuperação segura?

## Restrições

- O modo ativo permanece `Single Maintainer`.
- Não existe CI configurado no estado atual.
- Não existe Ruleset ou branch protection no estado atual.
- Pull Request, self-review e ausência de findings bloqueantes permanecem
  obrigatórios.
- Nenhuma aprovação humana independente pode ser simulada.
- Todo check configurado precisa passar, conforme a ADR 003.
- Os checks básicos não podem depender de secrets.
- A mesma validação precisa ser reproduzível fora do GitHub Actions.
- Dependências e Actions precisam ter versões imutáveis e verificáveis.
- A recuperação de falhas do CI ou da proteção não pode depender de push
  direto não auditado.
- O bootstrap não pode implementar ou alterar funcionalidade do produto.

## Alternativas consideradas

### Usar múltiplos required checks

Oferece granularidade no merge box, mas acopla o Ruleset aos nomes e à
quantidade de jobs. Renomear ou reorganizar validadores pode criar deadlock ou
exigir mudanças coordenadas na proteção. Rejeitada em favor de um gate externo
estável que agregue diagnósticos internos.

### Usar Branch Protection tradicional

Atende aos bloqueios básicos, mas oferece configuração e bypass menos
expressivos para o modelo pretendido. Rejeitada porque Rulesets permitem estado
nomeado, configuração revisável, inspeção das regras efetivas e bypass restrito
a Pull Requests.

### Executar validações somente no CI

Centraliza a execução, mas torna o GitHub o único ambiente capaz de reproduzir
uma falha e aumenta o tempo de feedback. Rejeitada por contrariar o requisito de
evidência local reproduzível.

### Executar validações somente localmente

Mantém feedback rápido, mas não produz um gate independente da estação do
mantenedor nem impede merge sem evidência. Rejeitada porque não transforma a
governança documental em enforcement do repositório.

### Permitir bypass irrestrito

Facilita recuperação, mas também permite push direto ou merge sem trilha
proporcional ao risco. Rejeitada porque exceção operacional não pode se tornar
fluxo normal.

### Não proteger o repositório enquanto houver um único mantenedor

Evita risco de lockout, mas preserva falhas já conhecidas e confunde ausência de
revisor com ausência de controles técnicos. Rejeitada porque a ADR 003 permite
automação compatível com `Single Maintainer` e exige checks configurados.

## Decisão

Adotar um bootstrap de governança com três responsabilidades separadas:

1. `tools/governance` será a implementação local canônica das validações;
2. GitHub Actions executará remotamente os mesmos comandos locais;
3. um GitHub Ruleset aplicará os gates à branch padrão.

O contrato externo de CI será um único status check obrigatório e estável
chamado `CEF Governance`. Validadores internos poderão manter diagnósticos
específicos sem expor seus nomes como dependências do Ruleset.

O Ruleset da branch padrão deverá:

- exigir Pull Request;
- exigir o check `CEF Governance`, produzido pelo GitHub Actions;
- exigir que a branch esteja atualizada antes do merge;
- exigir resolução das conversas;
- usar `required approvals = 0` enquanto o modo for `Single Maintainer`;
- não exigir aprovação de CODEOWNER ou revisor humano inexistente;
- bloquear force push;
- bloquear exclusão;
- impedir push direto normal;
- permitir bypass somente nos limites do workflow de mudança emergencial e da
  política operacional aprovada para o bootstrap.

O bypass deverá ser restrito ao papel real de administrador e ao modo
`pull_request`. Seu uso não aprova conteúdo, não substitui check existente e
precisa preservar Pull Request, autoridade, justificativa, risco, evidência,
rollback e reconciliação posterior.

Esta decisão não altera o modo de governança nem satisfaz, isoladamente, os
critérios humanos para `Engineering Team`.

### Segurança

O workflow deverá:

- declarar `permissions` mínimas, inicialmente `contents: read`;
- executar sem repository, organization ou environment secrets;
- usar o evento `pull_request`, não `pull_request_target`;
- usar somente Actions oficiais do GitHub no bootstrap inicial;
- fixar toda Action por SHA completo verificado;
- executar em runner efêmero hospedado pelo GitHub;
- não usar runner self-hosted;
- configurar checkout sem persistência de credenciais;
- não interpolar conteúdo não confiável da Pull Request em comandos shell;
- não conceder capacidade de criar ou aprovar Pull Requests.

O repositório deverá manter a permissão padrão do `GITHUB_TOKEN` como leitura,
impedir workflows de aprovar Pull Requests e exigir pin de Actions por SHA
completo. Nenhum token operacional será versionado.

### Toolchain

O tooling será isolado em `tools/governance`, com manifesto e lockfile próprios,
sem determinar o gerenciador de pacotes do futuro produto.

A versão inicial adotada é:

- Node.js `24.19.0` LTS;
- npm `11.17.0`;
- `markdownlint-cli2` `0.23.2`;
- `markdown-it` `14.3.0`;
- `yaml` `2.9.0`;
- `secretlint` `13.0.4`;
- `@secretlint/secretlint-rule-preset-recommend` `13.0.4`;
- testes com o runner nativo `node:test`.

Dependências diretas serão fixadas em versões exatas e resoluções transitivas
serão registradas no lockfile. Atualizações compatíveis podem seguir o fluxo
normal de dependências; mudança de runtime, responsabilidade ou isolamento pode
exigir ADR sucessora conforme as condições abaixo.

## Consequências positivas

- Os principais controles do CEF tornam-se verificáveis antes do merge.
- A execução local e a execução remota compartilham uma única implementação.
- O Ruleset depende de um nome estável, reduzindo risco de lockout por refactor
  interno do CI.
- `main` passa a rejeitar push direto normal, force push, exclusão e merge sem o
  check obrigatório.
- O modo `Single Maintainer` continua operacional sem aprovação fictícia.
- O contexto de PR executa sem secrets e com token somente leitura.
- A configuração desejada do Ruleset pode ser versionada e comparada com o
  estado efetivo do GitHub.

## Consequências negativas

- Uma falha no check agregado pode bloquear qualquer mudança até correção ou
  exceção formal.
- O mantenedor único continua concentrando autoria, decisão, administração e
  merge.
- O bootstrap adiciona runtime e dependências exclusivas de governança.
- Regras externas do GitHub podem divergir do estado versionado.
- Pin por SHA reduz mutabilidade, mas exige atualização deliberada para receber
  correções de segurança.
- A automação valida estrutura e evidência objetiva, mas não substitui revisão
  semântica ou humana.

## Riscos

- **Lockout por configuração incorreta:** mitigar com rollout em fases,
  Ruleset inicialmente desabilitado, verificação efetiva e bypass somente por
  Pull Request.
- **Renomeação do required check:** preservar `CEF Governance` como contrato e
  fazer qualquer substituição em duas fases.
- **Comprometimento da cadeia de dependências:** usar versões exatas, lockfile,
  Actions oficiais, SHA completo, token somente leitura e ausência de secrets.
- **Execução de conteúdo não confiável:** usar runner efêmero, evento
  `pull_request`, checkout sem credencial persistida e nenhuma permissão de
  escrita.
- **Falso positivo:** exigir caso de regressão, correção estreita e bypass apenas
  quando houver impacto operacional enquadrado no fluxo emergencial.
- **Normalização do bypass:** registrar cada uso, proibir conveniência e exigir
  reconciliação com responsável e prazo.
- **Indisponibilidade do GitHub Actions:** manter comandos locais reproduzíveis e
  aplicar o workflow emergencial sem representar evidência local como execução
  do check existente.
- **Drift do Ruleset:** versionar o estado desejado e verificar a configuração
  retornada pelo GitHub após criação e mudanças.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-10. Sua adoção
deverá ocorrer na seguinte ordem:

### Fase A — Tooling local

Criar a implementação canônica, dependências fixadas, lockfile, documentação e
testes positivos e negativos, sem depender do GitHub Actions.

### Fase B — GitHub Actions sem Ruleset ativo

Adicionar o workflow que executa os mesmos comandos locais, com permissões e
pinning definidos nesta decisão.

### Fase C — Validação positiva do check

Executar a Pull Request do bootstrap e confirmar que `CEF Governance` existe,
termina com sucesso e produz evidência diagnóstica suficiente.

### Fase D — Ruleset desabilitado

Criar o Ruleset inicialmente desabilitado com a configuração aprovada, sem
alterar ainda a capacidade de merge.

### Fase E — Verificação efetiva

Comparar o estado retornado pelo GitHub com a configuração versionada, incluindo
target, check, origem, atualização de branch, conversas, aprovações, bypass,
force push e exclusão.

### Fase F — Ativação

Ativar o Ruleset somente depois que o check tiver sido observado e a
recuperação estiver documentada. Confirmar que a Pull Request válida permanece
apta sob o modo `Single Maintainer`.

### Fase G — Validação negativa

Abrir Pull Request temporária com uma violação controlada, confirmar falha de
`CEF Governance` e estado de merge bloqueado, e fechá-la sem merge. Não testar
force push ou exclusão por operação destrutiva.

O merge da implementação continuará dependendo de decisão humana explícita e
dos gates do workflow oficial de Pull Request.

## Reversão

Reversão deve preservar o máximo de proteção segura e obedecer à seguinte
ordem:

1. diante de falso positivo ou falha do workflow, corrigir por Pull Request;
2. se houver deadlock qualificado, usar somente o bypass emergencial auditável;
3. antes de renomear ou remover o workflow, retirar ou substituir o required
   check no Ruleset em duas fases;
4. reverter tooling e workflow por Pull Request;
5. remover ou desabilitar o Ruleset somente quando ele próprio for a causa e não
   existir recuperação mais restrita;
6. verificar novamente `main` e registrar reconciliação e follow-ups.

Se uma Action falhar ou for comprometida, retornar ao último SHA oficial
conhecido e validado ou remover a dependência. Nenhum rollback autoriza ignorar
finding P0, P1 ou `blocking`.

## Critérios de sucesso

- A execução local completa é determinística e documentada.
- `CEF Governance` executa em toda Pull Request e em `main`.
- Os casos negativos comprovam falha dos validadores correspondentes.
- O contexto básico de CI não usa secrets nem permissão de escrita.
- Todas as Actions usam SHA completo verificado.
- O Ruleset ativo corresponde ao estado versionado.
- Pull Request e `CEF Governance` são obrigatórios para `main`.
- Branch desatualizada e conversa não resolvida impedem merge.
- Push direto normal, force push e exclusão de `main` são bloqueados.
- Uma Pull Request com `CEF Governance` falhando não pode ser mergeada.
- O bypass é restrito, auditável e não representa aprovação.
- O modo permanece `Single Maintainer`.
- Nenhuma funcionalidade do produto é alterada.

## Relação com a ADR 003

Esta decisão complementa a ADR 003 e não a substitui. A ADR 003 define o modo
`Single Maintainer`, a autoridade humana e a regra de que checks configurados
precisam passar. A ADR 004 estabelece a infraestrutura que materializa parte desses
gates.

A disponibilidade de CI e Ruleset remove lacunas de automação, mas não cria
revisão humana independente, não transforma revisão assistida em aprovação e
não ativa `Engineering Team`. A transição de modo continua condicionada a todos
os critérios cumulativos da ADR 003 e a uma ADR sucessora específica.

## Condições para ADR sucessora

Uma nova ADR será necessária se houver mudança durável em qualquer destes
limites:

- substituição de GitHub Actions como executor remoto;
- substituição de Rulesets como enforcement principal de `main`;
- adoção de múltiplos required checks como contrato externo;
- alteração do nome estável `CEF Governance`;
- concessão de bypass fora da política emergencial aprovada;
- uso de runner self-hosted, secrets ou permissões de escrita nos checks
  básicos;
- acoplamento do tooling de governança ao runtime ou gerenciador do produto;
- mudança que altere responsabilidades, fonte canônica ou modelo de confiança;
- transição para o modo `Engineering Team` quando relacionada a estes controles.

Atualizações de patch, correções de validadores ou troca de SHA de uma mesma
Action oficial podem seguir plano e Pull Request, desde que preservem a decisão
e seus limites.

## Referências

- `docs/engineering/constitution.md`
- `docs/adr/003-single-maintainer-governance.md`
- `docs/engineering/standards/security.md`
- `docs/engineering/standards/dependencies.md`
- `docs/engineering/workflows/pull-request.md`
- `docs/engineering/workflows/governance-bootstrap.md`
- `docs/engineering/workflows/emergency-change.md`
- `.github/CODEOWNERS`
