# ADR 016 — Deterministic Commercial Action Planning and Candidate Provenance

- **Status:** Accepted
- **Data:** 2026-08-13
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

As ADRs 008 e 009 definiram o domínio comercial, a máquina de estados,
Commercial Commands idempotentes e Commercial Events append-only. As ADRs 010
e 011 definiram Commercial Facts, policies determinísticas, Commercial
Decisions imutáveis, Authority separada de Executor, currentness da Decision e
aplicação material exatamente uma vez. As ADRs 012, 014 e 015 definiram a
fronteira não autoritativa de interpretação, Evidence determinística e o
catálogo completo de requirement IDs.

O sistema já consegue avaliar uma `requestedAction` escolhida pelo consumidor e
aplicar uma Decision válida. Ele ainda não representa, de forma determinística
e auditável, qual próxima ação vale a pena submeter ao Decision Engine para um
Lead no contexto atual. O Cockpit e outros consumidores precisam escolher a
ação diretamente, sem provenance persistida da recomendação anterior à
Decision.

O Épico 05 precisa preencher somente essa lacuna. O Planner não pode duplicar a
Policy, conceder `allow`, substituir a máquina de estados, criar Authority,
aplicar ação material ou introduzir outro ledger de execução. A RFC-0001
permanece não autorizadora e exige protocolo comum com domínio independente;
esta decisão deve continuar específica do domínio comercial.

## Problema

Como registrar uma próxima ação comercial determinística, imutável e não
autoritativa, permitindo submetê-la ao Decision Engine e aplicar uma Decision
válida exatamente uma vez, sem duplicar Policy, currentness, Authority,
Commercial Commands, Decision Applications ou criar orquestração universal?

## Restrições

- O objetivo v1 será exclusivamente `progress_commercial_case@1.0.0`.
- Cada Action Plan produzirá exatamente zero ou um Action Candidate.
- Action Plan e Action Candidate serão imutáveis.
- `no_action` será resultado do Plan e não persistirá Candidate placeholder.
- O Planner será determinístico e não autoritativo.
- O Planner não produzirá nem persistirá `allow`.
- O Decision Engine continuará sendo a única autoridade de Policy para a
  `requestedAction`.
- O Planner v1 considerará somente `create_opportunity`,
  `transition_to_discovery` e `transition_to_qualified`.
- Missing requirements usarão catálogo ordinal fechado, sem score.
- Candidate não será Decision, Authority, permissão ou execução.
- `collect_requirement` e resolução de Fact conflict não poderão originar
  Decision.
- Hard exclusion não poderá ser convertida em human override.
- Candidate currentness será gate somente antes da criação de uma Decision
  associada.
- Depois da Decision persistida, a aplicação será governada exclusivamente
  pela ADR 011 e pelas invariantes da Decision.
- Não haverá IA, LLM, prompt, score, confidence, embeddings, semantic ranking,
  agent loop ou model call.
- Não haverá canal, outbound Message, draft, agendamento, follow-up, worker,
  fila, Redis, BullMQ ou n8n comercial.
- Não haverá auto-replanning nem aplicação automática.
- Não haverá tabela ou ledger adicional de Action Execution.
- PostgreSQL continuará sendo a fonte de verdade.
- O ambiente continuará local, sem autenticação real e com referências humanas
  declarativas.
- Nenhuma decisão desta ADR autoriza implementação enquanto seu status for
  `Proposed`.

## Alternativas consideradas

### Manter a escolha de `requestedAction` somente no consumidor

Preservaria a arquitetura atual e não exigiria novos registros. Porém, não
explicaria qual ação foi recomendada, com qual objetivo, contexto, catálogo e
versão do Planner. Rejeitada porque não atende à provenance auditável exigida
para o Épico 05.

### Calcular a próxima ação sem persistir Plan ou Candidate

Seria a solução de menor armazenamento, mas impediria provar replay,
concorrência, staleness pré-Decision e associação entre a recomendação e a
Decision criada. Rejeitada.

### Fazer o Planner criar `allow` ou persistir uma Decision automaticamente

Reduziria uma etapa, mas criaria autoridade concorrente com o Decision Engine e
misturaria recomendação com autorização. Rejeitada. O Planner somente escolhe
qual ação considerar e classifica o fluxo downstream permitido.

### Produzir múltiplos Candidates e ordená-los por score

Permitiria ranking de alternativas, mas exigiria critérios de comparação ainda
não aprovados, criaria ambiguidade sobre a próxima ação e reintroduziria score
sem calibração. Rejeitada em favor de zero ou um Candidate por Plan.

### Permitir que qualquer Candidate origine Decision

Uniformizaria o contrato, porém permitiria transformar coleta de informação ou
resolução de conflito em tentativa de autorização material. Rejeitada. A
admissibilidade dependerá do Candidate type e de `requiredCapabilityKey`.

### Revalidar o Planner durante a aplicação material

Pareceria adicionar segurança, mas faria uma mudança de Planner, objetivo ou
prioridade invalidar retroativamente uma Authority já materializada em
Commercial Decision. Também criaria um terceiro mecanismo de currentness.
Rejeitada. Depois da Decision persistida, a ADR 011 é a fonte canônica.

### Criar `commercial_action_executions`

Facilitaria uma leitura isolada da execução, mas duplicaria o vínculo já
representado por Commercial Decision, Commercial Decision Application,
Commercial Command, Commercial Event e recurso afetado. Rejeitada. A execução
será uma projeção dessas fontes existentes.

### Criar catálogo dinâmico de objetivos, capabilities ou tools

Anteciparia múltiplos objetivos e executores sem consumidores comprovados e
aproximaria a solução de um Commercial ou Universal Orchestrator. Rejeitada
conforme o padrão de arquitetura e a RFC-0001.

### Usar LLM para escolher a próxima ação

Poderia produzir justificativas flexíveis, mas tornaria a escolha não
reproduzível e aproximaria inferência de Authority. Rejeitada. Nenhum output de
IA participa desta decisão.

## Decisão

Adotar um Commercial Action Planner determinístico e específico do domínio que
persiste Action Plan e, quando existir, exatamente um Action Candidate. O
Planner responde somente:

> Qual ação vale a pena submeter ao Decision Engine agora?

O fluxo de autoridade permanece:

```text
Action Plan
  -> Action Candidate não autoritativo
    -> Commercial Decision
      -> Commercial Decision Application
        -> Commercial Command + Commercial Event + estado de domínio
```

Candidate não é promovido a Decision nem a execução. Cada conceito preserva
sua identidade e fonte de verdade.

### Objective v1

O único objetivo será:

- key: `progress_commercial_case`;
- version: `1.0.0`;
- identidade canônica: `progress_commercial_case@1.0.0`;
- digest SHA-256 do artefato versionado.

Esse objetivo significa escolher o próximo gate estrutural coberto pelo
Planner v1. Ele não significa maximizar receita, conversão, probabilidade de
fechamento, score, velocidade ou qualquer Outcome comercial não modelado.

Não haverá tabela, seleção pelo cliente ou catálogo dinâmico de objetivos. Uma
mudança de significado exige nova versão e, quando material, ADR sucessora.

### Requested actions do Planner v1

O mapeamento estrutural será fechado e versionado:

| Contexto atual | `requestedAction` considerada |
|---|---|
| Lead `open`, sem Opportunity | `create_opportunity` |
| Opportunity em `open` | `transition_to_discovery` |
| Opportunity em `discovery` | `transition_to_qualified` |
| Qualquer outro contexto | `no_action` |

Estados fora desse subconjunto não são baixa prioridade. Eles estão
explicitamente fora da capacidade do Planner v1 e produzem `no_action`.

As demais requested actions da ADR 011 continuam válidas para avaliação
explícita por consumidores existentes. Esta decisão apenas limita quais delas o
Planner pode selecionar.

### Uso do Decision Engine sem duplicar Policy

Depois de selecionar uma requested action, o Planner usará o evaluator puro e
canônico do Decision Engine para obter, de forma transitória, os requisitos e
o outcome que orientam a classificação do Candidate.

O Planner não:

- reimplementará gates, thresholds, hard exclusions ou matriz de Policy;
- persistirá esse resultado transitório como Decision;
- retornará `allow` como autorização própria;
- criará `eligibleActions` concorrentes;
- alterará o outcome calculado pelo evaluator.

O mapeamento determinístico será:

| Resultado canônico consultado | Resultado do Plan |
|---|---|
| `block` | `no_action` |
| `require_information` | Candidate `collect_requirement` |
| `require_human_review` | Candidate `request_human_review` |
| `allow` | Candidate `submit_material_action` |

Esse mapeamento classifica o fluxo downstream e não transforma o Planner em
Authority.

### Action Plan

Action Plan será imutável e registrará, no mínimo:

- ID, Organization, Lead e Opportunity aplicável;
- objective key, version e digest;
- planner key, version e digest;
- action-catalog key, version e digest;
- requirement-priority key, version e digest;
- `inputFingerprint`;
- `outputDigest`;
- resultado `candidate` ou `no_action`;
- rationale codes fechados;
- input snapshot técnico minimizado;
- `executorRef` declarativo;
- timestamp atribuído pelo PostgreSQL.

Não haverá status mutável, `updatedAt`, execução embutida ou transição de
lifecycle. Currentness será derivada pela recomputação definida nesta ADR.

### Action Candidate

Action Candidate será imutável, não autoritativo e conterá, no mínimo:

- ID, Organization, Lead e Opportunity aplicável;
- Action Plan de origem;
- `candidateType`;
- `requestedAction` considerada;
- `requirementId`, somente quando aplicável;
- `requiredCapabilityKey`;
- rationale codes do Planner;
- reason codes canônicos consultados do Decision Engine;
- `decisionBasisFingerprint`;
- timestamp atribuído pelo PostgreSQL.

Os Candidate types v1 serão exclusivamente:

- `collect_requirement`;
- `request_human_review`;
- `submit_material_action`.

Cada Plan admite no máximo um Candidate. Plan com `no_action` admite nenhum.
Cada Candidate poderá originar no máximo uma Commercial Decision; reavaliação
exigirá novo Plan e novo Candidate. Não haverá Candidate placeholder, mutable
status, ranking ou confidence.

### Requirement priority catalog

O catálogo será identificado como
`commercial-requirement-priority@1.0.0`. A prioridade será ordinal, fechada e
sem peso numérico de score:

1. `contact_has_reachable_channel`;
2. `company_ownership_type_known`;
3. `sales_process_known`;
4. `crm_usage_known`;
5. `sales_capacity_known`;
6. `commercial_owner_known`;
7. `recurring_inbound_known`;
8. `lead_volume_known`;
9. `average_ticket_known`;
10. `conversion_measurement_known`;
11. `roi_measurement_known`;
12. `pain_confirmed_with_evidence`;
13. `pain_recurring_with_evidence`;
14. `pain_measurable_with_evidence`;
15. `decision_maker_access_known`;
16. `budget_known`;
17. `operational_capacity_known`;
18. `timing_known`;
19. `nurture_revisit_date_known`;
20. `nurture_return_condition_known`.

Somente requirements realmente presentes em `missingRequirements` participam
da escolha. O primeiro aplicável produz o único Candidate
`collect_requirement`. IDs estruturais, de consistência, autoridade ou uso da
Decision que não representem informação coletável não serão convertidos em
pergunta.

Alterar a ordem exige nova versão do catálogo e novo digest. Isso não altera
Decisions já persistidas.

### Capability catalog

`requiredCapabilityKey` representará somente o fluxo downstream
semanticamente permitido. Ele não será Authority, permissão, role, tool,
executor, registry ou mecanismo de discovery.

O catálogo fechado v1 será:

- `collect_commercial_requirement_v1`;
- `resolve_commercial_fact_conflict_v1`;
- `review_commercial_exception_v1`;
- `submit_commercial_decision_v1`.

A capability `apply_allowed_commercial_decision_v1` será derivada somente
depois que uma Decision associada possuir outcome `allow`; ela não será o
`requiredCapabilityKey` original do Candidate e não será um action type.

Não haverá tabela de capabilities nem vínculo com tools.

### Candidate-to-Decision admissibility

| Candidate type | `requiredCapabilityKey` | Pode originar Decision? | Fluxo obrigatório |
|---|---|---:|---|
| `collect_requirement` | `collect_commercial_requirement_v1` | Não | Question Candidate -> humano registra Fact -> Plan stale -> novo Plan explícito |
| `request_human_review` | `resolve_commercial_fact_conflict_v1` | Não | correção completa de Facts pela ADR 010 -> novo Plan explícito |
| `request_human_review` | `review_commercial_exception_v1` | Sim | Decision `declared_human`, reason e Evidence conforme ADR 011 |
| `submit_material_action` | `submit_commercial_decision_v1` | Sim | Decision Engine com Authority apropriada |

Candidate com combinação diferente será inválido por schema e constraint.

Hard exclusion produz `block` e, portanto, `no_action`; nunca produz Candidate
de revisão humana. `declared_human` não transforma hard exclusion em `allow`.

### Question Candidate

`collect_requirement` armazenará somente o requirement ID canônico. A pergunta
será projeção determinística pelo catálogo de templates já definido pela ADR
012:

- não persistida;
- não gerada por LLM;
- não enviada a canal;
- vinculada ao Action Candidate e ao Plan de origem;
- sem Authority ou efeito material.

O Planner não dependerá da latest Decision, pois ela pode corresponder a outra
requested action. A projeção usará o requirement do próprio Candidate.

### Plan currentness antes da Decision

Enquanto o Candidate ainda não tiver originado Commercial Decision, sua
submissão deverá, sob lock do Lead e na mesma transação da criação da Decision:

1. carregar Plan e Candidate no mesmo escopo;
2. recomputar o Plan com a versão registrada;
3. comparar `inputFingerprint`;
4. comparar `outputDigest`;
5. validar objective, planner, action catalog e requirement-priority metadata;
6. confirmar que o Candidate recomputado é semanticamente idêntico;
7. recomputar o Decision basis pelo evaluator canônico;
8. comparar `decisionBasisFingerprint`;
9. validar a matriz de admissibilidade;
10. somente então persistir a Commercial Decision e sua provenance.

Qualquer divergência rejeita o Candidate como stale. O Plan e o Candidate não
são atualizados; novo planejamento exige comando explícito.

### Authority depois da Decision

Depois que uma Commercial Decision válida for persistida, Plan e Candidate
tornam-se provenance histórica. Mudanças posteriores de:

- planner version ou digest;
- objective version ou digest;
- action-catalog version ou digest;
- requirement-priority version ou digest;

não invalidam por si só a Decision existente.

A aplicação material passa a ser governada exclusivamente por:

- Decision currentness;
- Decision outcome;
- Decision requested action;
- Decision Authority;
- Decision unused;
- integridade estrutural e cross-Organization;
- Commercial Decision Application;
- Commercial Commands e Events;
- ADR 011.

Planner currentness não será revalidada na aplicação e não será um novo gate de
Authority. Candidate permanece provenance, nunca autorização.

### Fingerprint model

Existirão duas responsabilidades, sem terceiro mecanismo de currentness.

#### Plan `inputFingerprint`

Será SHA-256 de representação canônica contendo:

- canonicalization version;
- Organization, Lead e Opportunity aplicáveis;
- Lead status, Opportunity state e contact reachability;
- active Fact snapshots com key, schema version, status, valor e Fact IDs
  ordenados;
- policy key, version e digest aplicável;
- objective key, version e digest;
- planner key, version e digest;
- action-catalog key, version e digest;
- requirement-priority key, version e digest;
- requested action considerada ou ausência estrutural dela.

Não incluirá timestamps de persistência, ordem acidental de query, latest
Decision ID, Message, Candidate de IA, `executorRef` ou texto comercial.

`outputDigest` cobrirá a forma canônica do resultado, Candidate type,
requested action, requirement ID, capability e rationale codes. A currentness
pré-Decision exige coincidência dos dois valores.

#### `decisionBasisFingerprint`

Será exatamente o `inputFingerprint` canônico produzido pelo Decision Engine
para a requested action correspondente, ou valor calculado pela mesma função
canônica existente. Não haverá algoritmo equivalente separado no Planner.

Na criação Candidate-to-Decision, o Plan e o Decision basis serão revalidados.
Depois da Decision persistida, somente o fingerprint e as invariantes da
Decision governam a aplicação.

### Commands, idempotência e concorrência

O planejamento reutilizará a ADR 009 com o command type
`plan_commercial_action_v1`. Mesma Idempotency-Key e mesmo request hash
retornam o mesmo Plan; mesma chave com hash diferente retorna conflito.

A criação de Decision por Candidate usará
`evaluate_commercial_action_candidate_v1`, reutilizando o mesmo ledger e o
mesmo evaluator do Decision Engine.

Uma constraint única sobre a provenance impedirá duas Decisions para o mesmo
Candidate, inclusive quando requisições concorrentes usarem Idempotency-Keys
diferentes. Replay da criação da Decision continuará pertencendo ao Commercial
Command; nova avaliação exigirá novo planejamento explícito.

Além da idempotência de request, Plans terão unicidade semântica por
Organization, Lead, planner version e input fingerprint. Isso não será outro
ledger nem substituirá Idempotency-Key; impedirá dois planejamentos
concorrentes com chaves distintas de persistirem Candidates duplicados para o
mesmo snapshot.

O Lead será bloqueado para recomputação e persistência. Opportunity será
validada e bloqueada quando aplicável. Constraints PostgreSQL preservarão
cardinalidade, escopo e provenance.

Aplicação concorrente continuará protegida por Decision Application única,
locks e revalidação da ADR 011. Retry com a mesma chave retorna o Command
existente; outra chave não aplica a mesma Decision novamente.

### Controlled application façade

`POST /commercial/action-candidates/:id/applications` será permitido somente
como façade controlada sobre os serviços materiais existentes.

A façade deverá:

1. carregar Candidate;
2. carregar a Decision associada;
3. validar a provenance Candidate-to-Decision;
4. validar Organization, Lead, Opportunity e requested action;
5. confirmar que a Decision possui outcome `allow`;
6. delegar ao application service já governado pela ADR 011;
7. reutilizar `commercial_decision_applications`;
8. reutilizar `create_opportunity_v1` ou `transition_opportunity_v1`;
9. retornar o Commercial Command receipt existente.

A façade não revalidará Planner currentness, não implementará transition logic,
não recalculará Authority, não redefinirá Decision staleness e não criará
ledger próprio.

O efeito continua explícito e separado da criação da Decision. Nenhuma
Decision `allow` é aplicada automaticamente.

### Persistência proposta

#### `commercial_action_plans`

Tabela append-only para Plan, com:

- FKs compostas de Organization, Lead e Opportunity;
- hashes e metadata versionada;
- input snapshot JSONB com shape de objeto;
- rationale codes JSONB com shape de array;
- resultado `candidate` ou `no_action`;
- unicidade semântica do snapshot;
- trigger de imutabilidade existente.

#### `commercial_action_candidates`

Tabela append-only para Candidate, com:

- FK composta para Plan no mesmo escopo;
- no máximo um Candidate por Plan;
- requested action do subconjunto v1;
- Candidate type e capability fechados;
- requirement ID com shape condicional;
- `decisionBasisFingerprint`;
- rationale e reason codes fechados;
- trigger de imutabilidade existente.

#### `commercial_decisions`

Receberá `action_candidate_id` nullable. Decisions históricas e avaliações
diretas continuarão com `null`. Decisions criadas pela rota de Candidate
exigirão a referência e validação de escopo e requested action. O valor será
único quando não nulo, garantindo no máximo uma Decision por Candidate.

Não será criada tabela de Action Execution. A projeção de execução será
Candidate -> Decision -> Decision Application -> Command -> Event/recurso.

### Migrations propostas

Uma futura implementação autorizada deverá usar migrations pequenas,
explícitas e reversíveis:

1. `021-create-commercial-action-plans`;
2. `022-create-commercial-action-candidates`;
3. `023-link-action-candidates-to-decisions`.

As duas primeiras migrations criarão as tabelas e triggers append-only. A
terceira adicionará FK nullable, unicidade e índice à tabela de Decisions.
`down` deverá remover somente os artefatos introduzidos por cada migration,
preservando todo o histórico anterior.

Esta ADR não cria nem autoriza migrations enquanto estiver `Proposed`.

### Contratos HTTP propostos

| Método e rota | Responsabilidade | Efeito autoritativo |
|---|---|---|
| `POST /commercial/leads/:id/action-plans` | criar ou retornar Plan idempotente | persiste Plan/Candidate; não cria Decision ou estado comercial |
| `GET /commercial/action-plans/:id` | ler Plan, Candidate e currentness derivada | nenhum |
| `POST /commercial/action-candidates/:id/decisions` | submeter Candidate admissível ao Decision Engine | persiste Decision, não aplica ação |
| `POST /commercial/action-candidates/:id/applications` | façade para aplicar Decision associada | delega ao comando material existente |

As rotas de Candidate não aceitarão requested action ou Opportunity arbitrária
do cliente. Esses valores serão carregados da provenance persistida. Todos os
comandos continuarão exigindo Idempotency-Key e validação Zod fechada.

### Auditoria e observabilidade

O event type mínimo será `commercial_action_plan_created`. Metadata allowlisted
conterá somente IDs técnicos, result type, Candidate type, requested action,
requirement ID, versions e rationale codes fechados.

Os eventos de Decision e aplicação existentes continuarão representando as
etapas posteriores, incluindo Candidate ID quando aplicável. Logs não conterão
Fact values, Message body, Evidence text, e-mail, telefone, CNPJ ou payload
integral.

Não haverá evento separado que finja execução do Candidate. O evento de
aplicação da Decision e o Commercial Command continuam sendo a evidência do
efeito material.

### Result e Outcome

- Plan result será `candidate` ou `no_action`.
- Decision outcome continuará `allow`, `block`, `require_information` ou
  `require_human_review`.
- Command result continuará sendo o recibo técnico da aplicação.
- Business Outcome, como venda ganha ou impacto econômico, não será inferido
  nem criado pelo Épico 05.

Esses conceitos não serão usados como sinônimos.

### Limites da RFC-0001

Esta decisão não cria Case, Run, Process Definition, Universal Orchestrator,
Commercial Orchestrator, package compartilhado, banco universal ou capability
runtime. Objective, Plan e Capability aqui definidos pertencem exclusivamente
ao domínio comercial e aos consumidores concretos do Épico 05.

O princípio preservado é: **protocolo comum, domínio independente**.

## Consequências positivas

- A recomendação anterior à Decision torna-se auditável e reproduzível.
- Planner e Decision Engine possuem responsabilidades distintas.
- Zero ou um Candidate elimina ranking e ambiguidade operacional no v1.
- Missing requirement produz uma única próxima pergunta determinística.
- Fact conflict não pode ser contornado por Decision humana.
- Hard exclusion permanece block e nunca vira human override.
- Candidate stale é bloqueado antes de criar Authority.
- Mudança futura de Planner não invalida Decision já persistida.
- Exactly-once continua apoiado no ledger existente.
- Nenhum estado de execução concorrente é introduzido.
- A solução permanece específica do domínio e sem IA.

## Consequências negativas

- O fluxo material ganha uma etapa explícita antes da Decision.
- Plans e Candidates aumentam armazenamento histórico append-only.
- Somente três requested actions serão consideradas pelo Planner v1.
- Estados fora do subconjunto produzem `no_action`, mesmo quando um humano
  poderia avaliar outra ação diretamente.
- O catálogo ordinal exige versionamento para mudar a ordem de perguntas.
- Consumers precisam distinguir currentness pré-Decision de Decision
  currentness pós-Decision.
- A façade de aplicação adiciona um contrato, embora reutilize integralmente o
  serviço material existente.
- Referências humanas continuam declarativas enquanto não existir autenticação.

## Riscos

- **Planner duplicar Policy:** mitigar chamando o evaluator canônico e proibindo
  gates, thresholds ou outcome próprios.
- **Candidate parecer autorização:** mitigar com nomenclatura, contratos e
  impossibilidade de aplicação sem Decision `allow`.
- **Planner currentness virar Authority pós-Decision:** mitigar encerrando esse
  gate no momento da persistência da Decision.
- **Fact conflict receber human bypass:** mitigar com capability exclusiva de
  correção e matriz de admissibilidade que proíbe Decision.
- **Hard exclusion virar review:** mitigar mapeando `block` exclusivamente para
  `no_action`.
- **Dois planners duplicarem Candidate:** mitigar com Lead lock, unicidade
  semântica e Commercial Command idempotente.
- **Decision associada a Candidate diferente:** mitigar com provenance
  persistida, escopo composto e validação transacional.
- **Façade duplicar lógica material:** mitigar exigindo delegação aos serviços e
  command types existentes.
- **Execution ledger paralelo divergir:** mitigar não criando a tabela e
  derivando leitura das fontes atuais.
- **Prioridade ordinal virar score implícito:** manter somente ordem fechada,
  sem peso, soma ou threshold.
- **Planner crescer para orquestrador:** limitar objetivo, actions,
  capabilities, entidades e consumidores ao domínio comercial aprovado.
- **Referência declarativa parecer autenticação:** manter ambiente local e
  limitações explícitas em contrato, Cockpit e documentação.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-13. A mesma decisão
autorizou separadamente a implementação do Épico 05, somente depois da
integração documental desta ADR em `main` pelo fluxo normal do CEF.

A adoção exige:

1. integração documental pelo fluxo normal do CEF;
2. implementação estrita do Planner determinístico sem IA;
3. schemas fechados para Plan, Candidate, objective, capabilities e priority;
4. migrations `021–023` com `up/down/up`;
5. currentness pré-Decision e Authority pós-Decision conforme esta ADR;
6. admissibilidade Candidate-to-Decision testada negativamente;
7. façade de aplicação delegando somente aos serviços da ADR 011;
8. concorrência, idempotência, staleness e aplicação única comprovadas;
9. vertical slices dos Épicos 01–05 verdes;
10. CEF Governance e Foundation CI verdes;
11. ausência de P0/P1 na revisão final.

Aceitar esta ADR não autoriza canal, dados reais, IA, deploy externo ou próximo
épico.

## Reversão

Enquanto `Proposed`, a ADR pode ser revisada ou rejeitada sem reversão de
produto porque nenhuma implementação está autorizada.

Depois de aceita e adotada, rollback de aplicação deverá impedir criação de
novos Plans e Candidates, mantendo leitura de provenance, Decisions,
Applications, Commands e Events já persistidos. Histórico imutável não será
apagado nem reescrito.

Remover o Planner não pode reabrir aplicação sem Decision. Reintroduzir
multiple Candidates, score, IA, auto-replanning, novo execution ledger,
currentness do Planner pós-Decision ou runtime universal exige ADR sucessora.

## Referências

- `docs/adr/008-commercial-domain-model-and-lifecycle.md`
- `docs/adr/009-commercial-audit-idempotency-and-external-identity.md`
- `docs/adr/010-commercial-fact-policy-and-decision-model.md`
- `docs/adr/011-decision-gated-commercial-actions-and-human-authority.md`
- `docs/adr/012-commercial-interpretation-boundary-and-candidate-evidence-model.md`
- `docs/adr/014-deterministic-evidence-alignment.md`
- `docs/adr/015-complete-commercial-requirement-catalog.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/api-contracts.md`
- `docs/engineering/standards/data-and-migrations.md`
- `docs/engineering/standards/documentation.md`
- `docs/engineering/standards/observability.md`
- `docs/engineering/standards/security.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
