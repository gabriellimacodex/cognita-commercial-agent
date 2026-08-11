# ADR 010 — Adotar o modelo de fatos, políticas e decisões comerciais

- **Status:** Accepted
- **Data:** 2026-08-11
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

As ADRs 008 e 009 estabeleceram o domínio comercial, seu ciclo de vida, o
estado autoritativo das entidades, a trilha de auditoria e a idempotência dos
comandos. O Épico 02 permite registrar Company, Contact, Lead, Opportunity,
Conversation, Message e Assignment, mas ainda não representa fatos comerciais
declarados nem registra por que uma ação seria elegível, bloqueada ou dependente
de revisão humana.

A documentação histórica de ICP e qualificação mistura critérios objetivos,
preferências, sinais, exceções e conceitos futuros de IA. Transformar todo esse
conteúdo diretamente em colunas, score ou regras não versionadas criaria
semântica que não foi aprovada. Também faria ausência de informação parecer
reprovação e permitiria que uma inferência adquirisse a mesma autoridade de um
fato explicitamente registrado.

O Épico 03 precisa de um modelo determinístico que preserve o PostgreSQL como
fonte de verdade, permita auditoria histórica e continue específico do domínio
comercial. A RFC-0001 não autoriza runtime, package, schema ou orquestrador
universal.

## Problema

Como representar fatos comerciais, policies determinísticas e decisões
auditáveis de forma mínima, versionada e preservável, distinguindo unknown,
false, conflito, evidência e autoridade sem introduzir score, inferência, DSL,
event sourcing ou abstração universal?

## Restrições

- PostgreSQL permanece a fonte de verdade para Facts e Decision Records.
- Entidades da ADR 008 permanecem fontes de verdade de seu estado atual.
- `commercial_events` permanece audit trail e não será usado para reconstruir
  Facts, Decisions ou entidades.
- Unknown nunca pode ser convertido implicitamente em `false`.
- Fato, inferência, recomendação, policy e decisão humana são conceitos
  distintos.
- Somente Facts do catálogo fechado podem participar da Policy v1.
- Facts precisam de provenance; evidence é obrigatória nos casos definidos por
  esta decisão e pela ADR 011.
- Não interpretar Message para produzir Fact no Épico 03.
- Não persistir inferência como Fact confirmado.
- Confidence numérica não será adotada no v1.
- Policies serão determinísticas e imutáveis por versão.
- Não criar tabela genérica de policies, editor ou DSL.
- Não implementar score.
- Decision Record não substitui Lead, Opportunity ou Commercial State.
- Não criar package `commercial-engine`, event bus, fila ou worker comercial.
- Não implementar IA, LLM, prompt, embedding ou automação de canal.
- A proposta não autoriza migration nem implementação enquanto estiver
  `Proposed`.

## Alternativas consideradas

### Adicionar campos de qualificação diretamente em Lead ou Opportunity

Facilitaria consultas pontuais, mas acoplaria Facts mutáveis ao lifecycle das
entidades, esconderia provenance e dificultaria preservar quais valores
sustentaram cada decisão. Também faria Opportunity possuir dados anteriores à
sua criação. Rejeitada.

### Usar `commercial_events` como armazenamento de Facts

Reutilizaria uma tabela existente, mas contrariaria a ADR 009: eventos registram
algo ocorrido e não são fonte de verdade nem mecanismo de reconstrução. Misturar
afirmações correntes e audit trail confundiria correção, conflito e consulta.
Rejeitada.

### Aceitar Fact keys e valores JSON arbitrários

Ofereceria flexibilidade, porém permitiria nomes, tipos e significados sem
revisão, impediria validação estável e esconderia mudanças de contrato dentro
dos dados. Rejeitada em favor de catálogo fechado e schema versionado.

### Criar uma tabela para cada dimensão de qualificação

Maximizaria especialização relacional, mas criaria muitas entidades para o
mesmo lifecycle de afirmação, provenance e correção. Não existe consumidor que
justifique essa fragmentação no v1. Rejeitada.

### Manter apenas o valor mais recente por Fact key

Simplificaria leitura, mas implementaria last-write-wins e apagaria conflito ou
correção histórica. Rejeitada porque fatos incompatíveis devem interromper a
decisão até resolução explícita.

### Persistir policies editáveis no banco ou criar uma DSL

Permitiria alteração em runtime, mas introduziria parser, validação, autorização,
rollout e rollback de regras sem necessidade comprovada. Também aumentaria o
risco de uma regra mudar sem revisão de código e golden tests. Rejeitada.

### Implementar score de qualificação

Produziria uma ordenação simples, porém não existem pesos calibrados, histórico
de outcomes ou ação que exija uma variável contínua. Score esconderia hard
exclusions, unknown e revisão humana em um número. Rejeitada; gates discretos
são suficientes para o Épico 03.

### Atribuir confidence a toda afirmação

Anteciparia uso futuro de modelos probabilísticos, mas Facts do v1 são
declarações ou observações determinísticas. Um número sem método de calibração
produziria falsa precisão. Rejeitada. Inferências futuras exigirão modelo e
decisão próprios.

### Registrar somente o resultado mais recente da avaliação

Reduziria armazenamento, mas reescreveria história quando a policy ou os Facts
mudassem. Rejeitada em favor de Decision Records imutáveis e reavaliação
explícita.

## Decisão

Adotar três conceitos comerciais específicos e separados:

1. **Commercial Fact:** afirmação tipada, versionada e com provenance sobre um
   Lead e seu contexto comercial;
2. **Commercial Policy:** definição determinística e imutável em código que
   avalia Facts e estado autoritativo;
3. **Commercial Decision Record:** registro imutável da avaliação de uma única
   `requestedAction`, com versão da policy, inputs e output estruturado.

Esses conceitos permanecem dentro do domínio comercial. Eles não constituem
Commercial OS, Commercial Orchestrator ou implementação da RFC-0001.

### Commercial Fact

Um Fact deverá conter, no mínimo:

- ID técnico;
- Organization e Lead;
- `fact_key` pertencente ao catálogo;
- `fact_schema_version` positivo;
- tipo de valor;
- valor validado de acordo com a definição;
- tipo e referência da fonte;
- referência de quem declarou;
- `observed_at` informado;
- `recorded_at` atribuído pelo PostgreSQL;
- evidence reference quando fornecida ou exigida;
- referências opcionais aos Facts corrigidos;
- referência de autoridade humana declarada quando for correção.

Facts serão imutáveis. Correção não atualiza nem exclui o registro anterior: um
novo Fact referencia explicitamente todos os Facts ativos que substitui. Os
registros corrigidos permanecem históricos, mas deixam de participar do
snapshot decisório.

Para representar a correção sem ambiguidade, o modelo persistente v1 exige a
menor extensão estrutural adicional: uma relação imutável
`commercial_fact_corrections`, na qual cada vínculo contém
`corrective_fact_id` e `corrected_fact_id`. Um Fact corretivo pode, assim,
substituir atomicamente um ou vários Facts. O vínculo singular
`corrects_fact_id` não será usado porque não consegue resolver explicitamente
um conjunto com mais de um Fact conflitante. `corrected_fact_id` será único na
relação, de modo que cada Fact histórico possa ser substituído no máximo uma
vez; os vínculos serão imutáveis e criados somente com o Fact corretivo.

Um Fact corretivo exige cumulativamente:

- `corrects_fact_ids` não vazio, contendo somente Facts ativos da mesma
  Organization, Lead, `fact_key` e `fact_schema_version`;
- evidence válida;
- `declared_human` como tipo de autoridade;
- referência da autoridade distinta da referência do executor, mesmo quando
  ambas identificarem declarativamente a mesma pessoa no ambiente local.

### Unknown, false e conflito

Unknown é a ausência de um Fact ativo válido para a chave requerida. Unknown
não é um valor persistido e nunca equivale a `false`, zero, string vazia ou
enum sentinela.

`false` é um valor booleano conhecido, explicitamente declarado e com
provenance. Uma policy pode tratar `false` como falha, hard exclusion ou revisão
humana somente quando a matriz da ADR 011 definir esse comportamento.

### Resolução determinística do conjunto ativo

O snapshot resolve cada chave no escopo exato de Organization, Lead,
`fact_key` e `fact_schema_version` pelas seguintes regras, nesta ordem:

1. Um Fact é imutável.
2. Um Fact participa do conjunto ativo se, e somente se, não for o
   `corrected_fact_id` de nenhum vínculo válido em
   `commercial_fact_corrections`.
3. Se o conjunto ativo estiver vazio, o valor da chave é unknown.
4. Se todos os Facts ativos forem semanticamente equivalentes segundo o tipo e
   schema do catálogo, o snapshot é `consistent`, expõe um único valor
   semântico e preserva as referências de todos os Facts que o sustentam.
5. Se existirem dois ou mais valores semânticos incompatíveis, o snapshot é
   `conflicting` e preserva todas as referências e valores participantes.
6. `recorded_at`, `observed_at`, ordem de inserção, fonte ou executor nunca
   escolhem silenciosamente um vencedor.

Unknown é ausência de Fact ativo. `false` conhecido continua sendo um valor
ativo e nunca é normalizado para unknown.

Uma correção é inserida em uma única transação com o novo Fact, todos os
vínculos de correção e o Commercial Event correspondente. Todo comando que cria
ou corrige Fact deve primeiro adquirir lock transacional na linha do Lead
proprietário. Esse mesmo lock é obrigatório para todos os writers de Facts do
Lead e permanece retido até o fim da transação; assim, nenhuma inserção
concorrente pode alterar o conjunto entre sua leitura e a escrita.

Depois de adquirir o lock, `corrects_fact_ids` deve ser comparado com o conjunto
completo de Facts ativos daquela `fact_key` e `fact_schema_version`. Os conjuntos
devem ser exatamente iguais; um subconjunto é rejeitado. Cada referência deve
apontar para Fact preexistente e ainda ativo e não pode cruzar Organization,
Lead, `fact_key` ou `fact_schema_version`.

Assim, quando há múltiplos Facts conflitantes, todos são referenciados e deixam
de participar do conjunto ativo na mesma transação. O novo Fact passa a ser o
único Fact ativo. Se outro Fact tiver sido inserido ou corrigido desde o
snapshot que originou o comando, o conjunto apresentado não coincidirá com o
conjunto carregado depois do lock, a correção será rejeitada como stale e deverá
ser refeita sobre o conjunto atual. Depois da comparação, o lock comum impede
novos writers até o commit. Os Facts substituídos e os vínculos permanecem
imutáveis e auditáveis.

Enquanto houver conflito, a avaliação que depende daquela chave produz
`require_human_review`. Uma Decision humana isolada não resolve o conflito. Não
haverá last-write-wins.

### Provenance e evidence

Provenance identifica como o Fact entrou no domínio. O v1 admite somente os
tipos de fonte `human_declaration` e `domain_record`. Não admite
`ai_inference`, classificação por texto ou origem desconhecida.

Evidence poderá usar somente os tipos fechados e validados no mesmo contexto,
inicialmente:

- Message persistida;
- Commercial Event persistido;
- `human_attestation` registrada explicitamente com o próprio comando.

Toda evidence fornecida deverá ser validada. Evidence é obrigatória para:

- `pain_confirmed`;
- `pain_recurring`;
- `pain_measurable`;
- todo Fact corretivo;
- Facts adicionais que a policy da ADR 011 marcar explicitamente.

O engine não lerá o conteúdo de Message para extrair Fact. A Message é apenas
evidence referenciada por uma declaração explícita.

### Catálogo fechado de Facts v1

| Fact key | Tipo e domínio | Schema | Papel inicial |
|---|---|---:|---|
| `company_ownership_type` | enum `private`, `public`, `government`, `nonprofit`, `other` | 1 | Fit/prioridade |
| `has_existing_sales_process` | boolean | 1 | Standard fit |
| `uses_crm` | boolean | 1 | Fit/exclusão objetiva |
| `seller_count` | inteiro maior ou igual a zero | 1 | Capacidade comercial |
| `commercial_owner_defined` | boolean | 1 | Standard fit |
| `has_recurring_inbound` | boolean | 1 | Fit/exclusão objetiva |
| `monthly_lead_volume` | inteiro maior ou igual a zero | 1 | Volume/prioridade |
| `average_ticket_brl_cents` | inteiro monetário maior ou igual a zero | 1 | Valor/revisão |
| `measures_conversion` | boolean | 1 | Standard fit/revisão |
| `roi_provable_within_90_days` | boolean | 1 | Standard fit |
| `sales_cycle_days` | inteiro positivo | 1 | Prioridade/revisão |
| `pain_confirmed` | boolean | 1 | Readiness |
| `pain_recurring` | boolean | 1 | Readiness |
| `pain_measurable` | boolean | 1 | Readiness |
| `decision_maker_access_confirmed` | boolean | 1 | Qualification |
| `budget_confirmed` | boolean | 1 | Qualification |
| `operational_capacity_confirmed` | boolean | 1 | Qualification |
| `timing_status` | enum `available_now`, `temporarily_unavailable`, `no_active_timing` | 1 | Qualification/nurture |
| `revisit_at` | timestamp futuro | 1 | Nurture |
| `nurture_return_condition` | enum fechado de condição objetiva | 1 | Nurture |

O catálogo inicial de `nurture_return_condition` será:

- `timing_window_opens`;
- `budget_cycle_opens`;
- `decision_process_resumes`;
- `operational_capacity_available`;
- `initiative_resumes`.

`meeting_economic_value` não pertence ao catálogo v1. A documentação não possui
threshold aprovado para transformar esse conceito em requisito decisório.

Company continua opcional no Lead conforme a ADR 008. Facts que descrevem o
contexto empresarial pertencem ao Lead avaliado e não autorizam inferência,
criação ou associação automática de Company.

### Commercial Policies

Policies serão definições imutáveis em código dentro da API enquanto ela for o
único consumidor. Não será criado package compartilhado.

Cada policy terá:

- `policy_key` estável;
- versão semântica exata;
- digest SHA-256 da representação canônica da definição;
- catálogo explícito de gates, requirements, reason codes e ações;
- golden tests que comprovem inputs e outputs representativos.

As policies iniciais propostas pela ADR 011 são:

- `opportunity-eligibility@1.0.0`;
- `commercial-state-gates@1.0.0`.

Uma versão publicada não será alterada semanticamente. Mudança de threshold,
gate, enum, precedência ou output cria nova versão. Disponibilizar uma versão
nova não reavalia casos existentes.

Não haverá policy editável em runtime, tabela genérica, DSL, prompt ou score.

### Commercial Decision Record

Toda avaliação material persistirá um Decision Record imutável contendo, no
mínimo:

- ID, Organization, Lead e Opportunity opcional;
- `decision_type`;
- uma única `requested_action`;
- `authority_type`;
- `authority_ref`;
- `executor_ref`;
- `policy_key`, `policy_version` e `policy_digest`;
- `decision_schema_version`;
- `input_fingerprint`;
- snapshot estrutural allowlisted, sem PII desnecessária;
- `outcome`;
- `eligible_actions`;
- `blocked_actions`;
- `missing_requirements`;
- `required_evidence`;
- `reason_codes`;
- `escalation_required`;
- timestamp atribuído pelo PostgreSQL.

Outcomes iniciais serão:

- `allow`;
- `block`;
- `require_information`;
- `require_human_review`.

O Decision Record poderá informar múltiplas ações em `eligible_actions`, mas a
semântica de autorização da única `requested_action` pertence à ADR 011.

### Decision Fact references e input fingerprint

Cada Decision Record referenciará imutavelmente todos os Facts ativos que
participaram da avaliação. A relação não copiará dados pessoais ou conteúdo de
Message.

O `input_fingerprint` será SHA-256 de representação canônica e versionada que
inclui:

- IDs e estados estruturais relevantes;
- requested action;
- IDs, keys, schema versions e valores semânticos dos Facts usados;
- policy key, version e digest;
- versão do contrato de canonicalização.

O payload canônico não será persistido no command ledger nem em logs. O
fingerprint detecta mudança de input; ele não substitui as referências e o
snapshot necessários à auditoria.

### Preservação histórica e reavaliação

Decision Records, suas Fact references e Facts serão append-only. Uma policy
nova ou um Fact novo não altera decisão anterior.

Reavaliação será sempre comando explícito, idempotente e produzirá novo Decision
Record. Não haverá scanner, atualização automática, worker, fila ou reavaliação
implícita por deploy.

Versões históricas de policy deverão permanecer identificáveis e testáveis pelo
período necessário à auditoria. Remoção de uma versão com Decisions existentes
exige plano próprio e não pode apagar os outputs já persistidos.

### Relação com Commercial Events e Commands

O estado atual de Facts e Decisions ficará nas estruturas próprias. A trilha
`commercial_events` poderá receber somente fatos de auditoria explícitos, como:

- `commercial_fact_recorded`;
- `commercial_decision_recorded`.

Metadata usará allowlist e conterá somente IDs, Fact key, outcome, policy key e
versão quando necessários. Não copiará valor do Fact, conteúdo de Message,
snapshot, nome, e-mail, telefone, CNPJ ou payload.

Criação de Fact, correção, avaliação e registro do respectivo Commercial Event
ocorrerão atomicamente com o `commercial_commands` da ADR 009. Replay não cria
Fact, Decision ou Event adicional.

### Minimização e retenção

Persistir somente Facts usados por uma policy ou por requisito aprovado. Sinais
sem ação concreta não serão coletados “para uso futuro”. Logs usarão IDs,
versions, keys e reason codes, nunca valores comerciais.

Esta ADR não define prazo de retenção. Antes de produção com dados reais será
obrigatória ADR específica para retenção, eliminação, anonimização, base legal
ou operacional, retenção de backup e tratamento de Facts, Decisions e Events
imutáveis. Nenhum deploy produtivo é autorizado por esta proposta.

## Consequências positivas

- Unknown, false e conflict possuem semânticas distintas e verificáveis.
- Facts preservam fonte, declarador, evidence e correções.
- Policies ficam revisáveis, reproduzíveis e protegidas por golden tests.
- Decisões históricas não mudam quando regras ou informações evoluem.
- Decision Records explicam outcomes por códigos e referências estruturadas.
- Score e inferência não ocultam hard exclusions ou autoridade humana.
- PostgreSQL continua sendo a única fonte de verdade comercial.
- A solução permanece específica do domínio e sem abstração universal.

## Consequências negativas

- Cada avaliação material adiciona registros imutáveis.
- Catálogo fechado exige mudança deliberada quando surgir novo Fact.
- Correção preserva registros antigos e torna consultas de Facts ativos mais
  cuidadosas.
- Escritas de Facts do mesmo Lead são serializadas e podem gerar contenção.
- Policies em código não podem ser alteradas por usuário em runtime.
- Ausência de confidence impede representar inferências probabilísticas no v1.
- Reavaliação explícita pode deixar casos antigos sob policy anterior até ação
  deliberada.
- Retenção permanece bloqueio para qualquer produção com dados reais.

## Riscos

- **Fact declarado incorretamente:** mitigar com provenance, evidence,
  correção explícita e auditoria.
- **Conflito ignorado por query incorreta:** mitigar com definição única de Fact
  ativo, testes concorrentes e outcome obrigatório de revisão humana.
- **PII copiada para audit trail:** mitigar com metadata allowlisted, redaction
  e testes de ausência de dados sensíveis.
- **Policy alterada sem nova versão:** mitigar com digest, golden tests e revisão
  do diff da definição canônica.
- **JSON estruturado virar contrato arbitrário:** mitigar com schemas fechados,
  schema version e validação nas fronteiras.
- **Decision Record virar estado autoritativo:** mitigar mantendo Lead e
  Opportunity como owners definidos na ADR 008.
- **Catálogo crescer por especulação:** exigir policy ou requisito consumidor
  para cada Fact novo.
- **Human attestation parecer identidade autenticada:** usar a designação
  `declared_human` e manter ambiente local.
- **Decision model virar Universal Orchestrator:** proibir Case, Run, runtime,
  fila ou package universal sem as pré-condições da RFC-0001.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-11. Sua aceitação,
em conjunto com a ADR 011, autoriza a implementação do Épico 03 estritamente
dentro do plano aprovado e dos limites das duas decisões.

A adoção deverá:

1. manter o engine dentro da API enquanto houver um único consumidor;
2. criar migrations pequenas, aditivas e reversíveis quando seguro;
3. criar contratos fechados para Facts e Decision Records;
4. implementar policies puras, versionadas e cobertas por golden tests;
5. preservar `commercial_commands` e `commercial_events` conforme a ADR 009;
6. provar unknown, false, conflict, correção, replay e preservação histórica;
7. manter os vertical slices dos Épicos 01 e 02 saudáveis;
8. não alterar Ruleset ou required checks;
9. manter o sistema local e sem deploy produtivo.

## Reversão

Depois de aceita e adotada, substituir Fact model, policy source, Decision
Record, semântica de conflict ou fonte de verdade exige ADR sucessora. Rollback
de aplicação deverá preservar Facts, Decisions, referências e Events já
persistidos. Apagar histórico ou tabelas exigirá autorização destrutiva,
backup e a ADR de retenção aplicável.

Desabilitar novas avaliações pode conter uma falha, mas não autoriza apagar ou
reinterpretar decisões anteriores.

## Referências

- `docs/01-icp.md`
- `docs/02-offer.md`
- `docs/03-commercial-process.md`
- `docs/04-qualification-rules.md`
- `docs/05-agent-behavior.md`
- `docs/06-state-machine.md`
- `docs/adr/008-commercial-domain-model-and-lifecycle.md`
- `docs/adr/009-commercial-audit-idempotency-and-external-identity.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/data-and-migrations.md`
- `docs/engineering/standards/security.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
