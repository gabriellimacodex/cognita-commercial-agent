# ADR 011 — Adotar ações comerciais governadas por decisão e autoridade humana

- **Status:** Accepted
- **Data:** 2026-08-11
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

A ADR 008 definiu Opportunity como única proprietária do Commercial State e
estabeleceu a máquina de estados vigente. A ADR 009 definiu comandos
idempotentes e eventos atômicos. A ADR 010 propõe Facts, policies e Decision
Records imutáveis para tornar a avaliação comercial determinística e
auditável.

No estado atual, os comandos de criação de Opportunity e de transição recebem
ator e motivo declarados, mas não exigem prova de que requisitos comerciais
foram avaliados. Manter esse caminho em paralelo com o Decision Engine tornaria
os novos gates opcionais e produziria duas autoridades concorrentes para a
mesma ação.

A Policy v1 precisa distinguir hard exclusion, standard fit, revisão humana,
sinal de prioridade e requisito ausente. Preferência não pode virar exclusão;
unknown não pode virar false; casos incompletos não podem ser enviados para
nurture. Qualified e estados terminais permanecem sob autoridade humana.

Os endpoints continuam locais e sem autenticação. Referências humanas são
declarativas conforme a ADR 008 e não podem ser apresentadas como identidade ou
autorização autenticada.

## Problema

Como tornar criação de Opportunity e transições comerciais dependentes de uma
decisão determinística, atual e aplicável uma única vez, preservando ações
human-only, catálogos fechados de motivo, idempotência e a máquina de estados
vigente sem manter bypass legado ou criar orquestração universal?

## Restrições

- Esta proposta depende da aceitação da ADR 010.
- Opportunity continua sendo a única owner do Commercial State.
- A máquina e as transições possíveis da ADR 008 não serão ampliadas.
- Uma Decision autoriza somente sua única `requestedAction`.
- `eligibleActions` é informativo e não concede autorização adicional.
- Criação de Opportunity e transições materiais exigirão Decision Record.
- Não haverá período de compatibilidade nem caminho legado paralelo.
- Decision obsoleta não pode ser aplicada.
- A mesma Decision material não pode ser aplicada duas vezes.
- Authority e Executor são responsabilidades separadas.
- `qualified`, `proposal`, `negotiation`, `won`, `lost` e `disqualified` são
  human-only no v1.
- `declared_human` não significa pessoa autenticada.
- Unknown nunca equivale a false ou hard exclusion.
- Conflict nunca usa last-write-wins.
- Nurture exige fit potencial, indisponibilidade temporal real, data e condição
  objetiva de retorno.
- Reason codes são fechados e versionados; texto livre não substitui código.
- O engine não interpreta Message, não calcula score e não usa IA.
- O fluxo permanece síncrono e sem Redis, BullMQ, worker ou n8n.
- Não alterar Ruleset ou required checks.
- Nenhuma produção ou exposição externa é autorizada.
- A proposta não autoriza implementação enquanto estiver `Proposed`.

## Alternativas consideradas

### Manter comandos antigos e adicionar rotas novas governadas por Decision

Preservaria compatibilidade interna, mas permitiria contornar todos os gates
usando o caminho antigo. Rejeitada porque enforcement opcional não é
governança.

### Fazer cada aplicação reavaliar a policy sem persistir Decision

Garantiria avaliação recente, porém perderia qual decisão autorizou o efeito e
quais Facts e versão foram usados. Rejeitada porque toda decisão material deve
ser auditável.

### Permitir que uma Decision autorize qualquer `eligibleAction`

Reduziria avaliações, mas ampliaria a autoridade do registro além da intenção
avaliada e permitiria reutilização ambígua. Rejeitada. Cada Decision autoriza
somente sua `requestedAction`.

### Confiar somente em Idempotency-Key para aplicação única

Evitaria novo vínculo de aplicação, mas outra chave poderia aplicar a mesma
Decision. Rejeitada porque idempotência de request e consumo único da decisão
são invariantes distintas.

### Permitir aplicação de Decision obsoleta

Simplificaria execução, mas uma alteração de Fact, vínculo ou estado poderia
invalidar o resultado. Rejeitada. O input será revalidado transacionalmente.

### Permitir transições terminais automáticas por hard exclusion

Tornaria disqualification rápida, porém terminalidade tem impacto comercial e
o ambiente não possui autenticação nem política operacional madura. Rejeitada;
o engine pode apontar a incompatibilidade, mas a transição permanece humana.

### Resolver conflito pelo Fact mais recente

Ofereceria resultado imediato, mas confundiria registro posterior com maior
veracidade. Rejeitada em favor de correção explícita, evidence e autoridade
humana declarada.

### Usar score para decidir avanço

Compactaria múltiplos critérios, mas esconderia diferenças entre hard block,
unknown, revisão e prioridade. Rejeitada conforme a ADR 010.

### Criar workflow assíncrono de revisão humana

Poderia organizar filas e SLAs, porém ainda não há autenticação, equipe ou
consumidor que justifique um Case ou runtime de orquestração. Rejeitada neste
épico. Escalation será resultado explícito da decisão e estado de interface, não
uma máquina paralela.

## Decisão

Adotar avaliação e aplicação síncronas, específicas do domínio comercial, com
uma Decision imutável para uma única `requestedAction`.

### Requested action e outputs

Uma avaliação deverá receber exatamente uma ação solicitada, inicialmente:

- `create_opportunity`;
- `transition_to_discovery`;
- `transition_to_qualified`;
- `transition_to_proposal`;
- `transition_to_negotiation`;
- `transition_to_nurture`;
- `transition_to_won`;
- `transition_to_lost`;
- `transition_to_disqualified`.

O output estruturado conterá:

- `decision`: `allow`, `block`, `require_information` ou
  `require_human_review`;
- `eligible_actions`, cada uma com autoridade exigida;
- `blocked_actions`, cada uma com reason codes;
- `missing_requirements`;
- `required_evidence`;
- `escalation_required`;
- `reason_codes`;
- policy key, version e digest;
- input fingerprint.

Uma ação presente em `eligible_actions` não está autorizada por aquela Decision
se não for também a `requestedAction`. Aplicar ação diferente exige nova
avaliação e novo Decision Record.

### Precedência dos resultados

Para a `requestedAction`, a policy aplicará esta precedência:

1. relação ou transição estrutural inválida produz `block`;
2. Fact conflitante produz `require_human_review`;
3. hard exclusion conhecida e não conflitante produz `block`;
4. requirement obrigatório unknown produz `require_information`;
5. critério de exceção ou ação human-only produz `require_human_review`;
6. todos os gates satisfeitos para ação determinística produzem `allow`.

Sinais de prioridade não mudam sozinhos `allow` para `block`. Eles produzem
reason codes informativos e podem compor revisão somente quando a matriz assim
determinar.

### Gates finais v1

| Gate | Responsabilidade | Resultado quando não satisfeito |
|---|---|---|
| `subject_integrity` | Confirma Organization, Lead, Contact e Opportunity aplicáveis | `block` |
| `structural_transition` | Aplica exclusivamente a máquina da ADR 008 | `block` |
| `lead_open` | Exige Lead `open` para criar Opportunity | `block` |
| `no_existing_opportunity` | Preserva uma Opportunity por Lead | `block` |
| `contact_reachable` | Exige e-mail ou telefone conhecido | `require_information` |
| `facts_consistent` | Detecta Facts ativos incompatíveis | `require_human_review` |
| `hard_exclusions_clear` | Verifica exclusões objetivas da oferta atual | `block` |
| `standard_fit` | Verifica perfil padrão e separa exceções | `require_information` ou `require_human_review` |
| `pain_evidenced` | Exige três Facts de pain e evidence válida | `require_information` ou `block` |
| `opportunity_ready` | Consolida readiness para criação | Conforme gates componentes |
| `qualification_complete` | Verifica authority, budget, capacity e timing | `require_information` ou `block` |
| `human_authority` | Reserva ações human-only | `require_human_review` |
| `nurture_eligible` | Exige fit potencial, timing, data e condição | `require_information`, `block` ou revisão |
| `terminal_reason_valid` | Valida reason catalog e evidence | `require_information` ou `block` |
| `decision_current` | Recalcula input fingerprint sob lock | conflito de aplicação |
| `decision_unused` | Impede segunda aplicação material | conflito de aplicação |

### Requirements finais v1

Requirements possuem IDs estáveis e apontam para estado de domínio ou Fact da
ADR 010. Eles não serão tabelas próprias.

- `lead_is_open`;
- `opportunity_does_not_exist`;
- `contact_has_reachable_channel`;
- `facts_are_consistent`;
- `crm_usage_known`;
- `sales_capacity_known`;
- `recurring_inbound_known`;
- `conversion_measurement_known`;
- `sales_process_known`;
- `commercial_owner_known`;
- `lead_volume_known`;
- `average_ticket_known`;
- `roi_measurement_known`;
- `pain_confirmed_with_evidence`;
- `pain_recurring_with_evidence`;
- `pain_measurable_with_evidence`;
- `decision_maker_access_known`;
- `budget_known`;
- `operational_capacity_known`;
- `timing_known`;
- `nurture_revisit_date_known`;
- `nurture_return_condition_known`;
- `human_authority_declared`;
- `terminal_reason_from_catalog`;
- `terminal_evidence_present`;
- `decision_input_is_current`;
- `decision_has_not_been_applied`.

### Matriz explícita da Policy v1

Os comportamentos abaixo são normativos para as duas policies propostas. Um
“hard block” bloqueia a requested action e torna o caso candidato objetivo a
disqualification; ele não executa a transição terminal, que permanece humana.

| Fact ou requisito de domínio | Unknown | Satisfied | Failed | Human review | Hard block | Ação ou estado |
|---|---|---|---|---|---|---|
| Contact com e-mail ou telefone | `require_information` | Gate satisfeito | Meio conhecido ausente exige informação corrigida | Não por si só | Não | `create_opportunity` |
| `company_ownership_type` | `require_information` para fit completo | `private` é standard fit e sinal positivo | Outros valores não excluem automaticamente | Perfil não privado exige revisão | Não | `create_opportunity` |
| `has_existing_sales_process` | `require_information` | `true` é standard fit | `false` não exclui automaticamente | `false` exige revisão | Não | `create_opportunity` |
| `uses_crm` | `require_information` | `true` satisfaz | `false` bloqueia oferta atual | Não substitui hard block | Sim | `create_opportunity`, disqualification candidate |
| `seller_count` | `require_information` | `>= 3` é standard fit | `0` bloqueia | `1–2` exige revisão | Sim somente para `0` | `create_opportunity`, disqualification candidate |
| `commercial_owner_defined` | `require_information` | `true` é standard fit | `false` não exclui automaticamente | `false` exige revisão | Não | `create_opportunity` |
| `has_recurring_inbound` | `require_information` | `true` satisfaz | `false` bloqueia oferta atual | Não substitui hard block | Sim | `create_opportunity`, disqualification candidate |
| `monthly_lead_volume` | `require_information` | `>= 500` é standard fit | `< 500` não exclui | `< 500` exige revisão | Não | `create_opportunity` |
| `average_ticket_brl_cents` | `require_information` | `>= 500000` satisfaz | `< 500000` não exclui | `< 500000` exige revisão | Não | `create_opportunity` |
| `measures_conversion` | `require_information` | `true` é standard fit | `false` indica gap de maturidade operacional, sem exclusão | `false` exige revisão humana | Não | `create_opportunity` |
| `roi_provable_within_90_days` | `require_information` | `true` é standard fit | `false` não exclui automaticamente | `false` exige revisão | Não | `create_opportunity` |
| `sales_cycle_days` | Não bloqueia; prioridade desconhecida | `<= 45` é sinal positivo | `> 45` reduz prioridade, sem bloqueio isolado | Pode compor revisão já exigida por outro critério | Não | Priorização informativa |
| `pain_confirmed` com evidence | `require_information` | `true` satisfaz | `false` bloqueia readiness | Conflito exige revisão | Não | `create_opportunity`, `transition_to_discovery`, qualification |
| `pain_recurring` com evidence | `require_information` | `true` satisfaz | `false` bloqueia readiness | Conflito exige revisão | Não | `create_opportunity`, qualification |
| `pain_measurable` com evidence | `require_information` | `true` satisfaz | `false` bloqueia readiness | Conflito exige revisão | Não | `create_opportunity`, qualification |
| `decision_maker_access_confirmed` | `require_information` | `true` satisfaz | `false` bloqueia qualification atual | Conflito exige revisão | Não | `transition_to_qualified` |
| `budget_confirmed` | `require_information` | `true` satisfaz | `false` bloqueia qualification atual | Conflito ou exceção exige revisão | Não | `transition_to_qualified` |
| `operational_capacity_confirmed` | `require_information` | `true` satisfaz | `false` bloqueia qualification atual | Conflito ou exceção exige revisão | Não | `transition_to_qualified` |
| `timing_status` para qualification | `require_information` | `available_now` satisfaz | `no_active_timing` bloqueia; `temporarily_unavailable` não qualifica agora | Exceção exige revisão | Não | `transition_to_qualified` |
| `timing_status` para nurture | `require_information` | `temporarily_unavailable` satisfaz o componente temporal | Outros valores não autorizam nurture | Fit em exceção exige revisão | Não | `transition_to_nurture` |
| `revisit_at` | `require_information` para nurture | Timestamp futuro satisfaz | Ausente, inválido ou não futuro bloqueia nurture | Conflito exige revisão | Não | `transition_to_nurture` |
| `nurture_return_condition` | `require_information` para nurture | Valor do catálogo satisfaz | Condição ausente ou fora do catálogo bloqueia nurture | Conflito exige revisão | Não | `transition_to_nurture` |

Os hard exclusions da Policy v1 são exclusivamente `uses_crm = false`,
`seller_count = 0` e `has_recurring_inbound = false`. Em particular,
`measures_conversion = false` não é hard exclusion nem motivo terminal: produz
`require_human_review` com `conversion_measurement_gap`.

`meeting_economic_value` não participa da Policy v1. Nenhum threshold substituto
será inferido a partir de ticket, volume, texto de Message ou declaração livre.

### Criação de Opportunity

`create_opportunity` poderá receber `allow` por policy somente quando:

- Lead está `open` e não possui Opportunity;
- Contact possui e-mail ou telefone conhecido;
- Facts requeridos são conhecidos, válidos e não conflitantes;
- nenhum hard exclusion está presente;
- os Facts de pain são verdadeiros e possuem evidence;
- nenhum critério da matriz exige revisão humana.

O standard fit automático exige, no v1:

- Company profile privado;
- processo comercial existente;
- CRM em uso;
- pelo menos três vendedores;
- responsável comercial definido;
- inbound recorrente;
- pelo menos 500 Leads mensais;
- ticket médio de pelo menos `500000` centavos de real;
- conversão medida;
- ROI demonstrável em até 90 dias;
- pain confirmado, recorrente e mensurável.

Critério abaixo do standard fit segue exatamente a matriz: alguns produzem hard
block e outros revisão humana. Preferência nunca se torna exclusão por soma de
sinais ou score.

### Commercial State

A validação estrutural da ADR 008 ocorre antes dos gates comerciais.

- `open → discovery`: policy pode autorizar quando readiness e pain permanecem
  satisfeitos.
- `discovery → qualified`: requirements de qualification devem estar
  satisfeitos, mas a autoridade final é sempre `declared_human`.
- `qualified → proposal`: exige decisão humana; oferta e termos não são
  inventados pelo engine.
- `proposal → negotiation`: exige decisão humana, pois negociação e exceções
  devem ser escaladas.
- `proposal | negotiation → won`: human-only com reason e evidence.
- estados permitidos `→ nurture`: policy pode autorizar somente com fit
  potencial conhecido, `temporarily_unavailable`, `revisit_at` futuro e
  condição objetiva de retorno.
- `nurture → discovery`: policy pode autorizar quando timing volta a
  `available_now` e os gates aplicáveis continuam satisfeitos.
- estados permitidos `→ lost | disqualified`: human-only com reason e evidence.

Missing information não autoriza nurture. Hard exclusion não autoriza nurture.
Nurture não substitui blocked, unknown, lost ou disqualified.

### Nurture, lost e disqualified

- **Nurture:** fit potencial conhecido, indisponibilidade temporária real,
  data futura e condição objetiva de retorno. Não terminal.
- **Lost:** Opportunity reconhecida cujo processo terminou sem ganho por motivo
  humano confirmado. Terminal.
- **Disqualified:** incompatibilidade objetiva e conhecida com hard exclusion
  da Policy v1. Terminal.

Unknown não é disqualification. Opportunity incompleta não é nurture. Um Lead
que nunca teve Opportunity não é lost.

Depois de `qualified`, a máquina da ADR 008 não permite `disqualified`; uma
incompatibilidade terminal descoberta nesse estágio deverá usar `lost` com
motivo aplicável ou exigir ADR sucessora da máquina.

### Reason-code catalogs v1

Reason codes serão fechados e vinculados ao catálogo
`commercial-reasons@1.0.0`.

#### Avaliação e gates

- `contact_channel_missing`;
- `fact_unknown`;
- `fact_conflict`;
- `fact_evidence_missing`;
- `lead_not_open`;
- `opportunity_already_exists`;
- `crm_not_used`;
- `no_sellers`;
- `no_recurring_inbound`;
- `conversion_measurement_gap`;
- `non_private_profile_requires_review`;
- `sales_process_requires_review`;
- `seller_count_requires_review`;
- `commercial_owner_requires_review`;
- `lead_volume_requires_review`;
- `average_ticket_requires_review`;
- `roi_window_requires_review`;
- `long_sales_cycle_priority_signal`;
- `pain_not_confirmed`;
- `pain_not_recurring`;
- `pain_not_measurable`;
- `decision_maker_access_not_confirmed`;
- `budget_not_confirmed`;
- `operational_capacity_not_confirmed`;
- `timing_not_available`;
- `nurture_revisit_missing`;
- `nurture_return_condition_missing`;
- `human_authority_required`;
- `decision_stale`;
- `decision_already_applied`.

`conversion_measurement_gap` é exclusivo de avaliação e revisão humana. Não é
reason code terminal nem pertence ao catálogo de `disqualified`.

#### Transições não terminais

- `discovery_started`;
- `human_qualification_confirmed`;
- `proposal_authorized`;
- `negotiation_started`;
- `nurture_timing_window_pending`;
- `nurture_budget_cycle_pending`;
- `nurture_decision_process_pending`;
- `nurture_operational_capacity_pending`;
- `nurture_initiative_paused`.

#### Won

- `commercial_agreement_confirmed`.

#### Lost

- `customer_declined`;
- `competitor_selected`;
- `commercial_terms_not_accepted`;
- `budget_lost_after_opportunity`;
- `initiative_cancelled`;
- `other_human_confirmed`.

#### Disqualified

- `crm_not_used`;
- `no_sellers`;
- `no_recurring_inbound`.

`other_human_confirmed` exige evidence e autoridade humana declarada. Nenhum
endpoint aceitará reason code fora do catálogo ou usará texto livre como
código primário.

### Authority e Executor

`authority_type` será:

- `policy`: a policy versionada concede autorização determinística;
- `declared_human`: uma pessoa declarada assume a decisão exigida pelo v1.

`authority_ref` identifica declarativamente quem ou qual policy possui a
autoridade. `executor_ref` identifica quem ou qual processo solicita e executa
o efeito técnico. Os campos são separados mesmo quando uma única pessoa atua
nos dois papéis.

O engine nunca se declara humano. Agente, self-review ou automação não se tornam
autoridade humana. `declared_human` continua sem autenticação e sem não repúdio,
somente no ambiente local aceito pela ADR 008.

Para ação human-only, o engine retorna `require_human_review`. A ação somente
poderá avançar quando um novo Decision Record, com
`authority_type = declared_human`, reason code permitido e evidence exigida,
autorizar a mesma `requestedAction`.

`declared_human` não é bypass universal. No v1, essa autoridade pode somente:

- satisfazer gates explicitamente human-only;
- decidir `transition_to_qualified` quando os demais gates estiverem
  satisfeitos;
- executar decisões terminais permitidas pela máquina da ADR 008;
- resolver Fact conflicts pelo processo da ADR 010;
- decidir casos classificados pela policy como `require_human_review`.

Mesmo nesses casos, a Decision humana permanece limitada à
`requestedAction`, aos inputs e à policy registrados. `declared_human` não pode
ignorar:

- `subject_integrity`;
- `structural_transition`;
- `lead_open`;
- `no_existing_opportunity`;
- `decision_current`;
- `decision_unused`;
- integridade cross-Organization;
- invariantes da ADR 008;
- hard exclusions vigentes da policy.

Um hard exclusion não se transforma em `allow` pela presença de
`declared_human`. Para remover o bloqueio é necessário corrigir, pelo processo
auditável da ADR 010, o Fact que o causou ou alterar e versionar a policy pelo
processo de governança aplicável. O v1 não terá mecanismo genérico de override.

### Conflict resolution

Uma avaliação que dependa de Fact conflitante retorna
`require_human_review` e não pode ser aplicada.

Resolução exige novo Fact corretivo conforme a ADR 010:

- o conjunto completo de Facts ativos é substituído atomicamente;
- a correção possui evidence e autoridade `declared_human`;
- Facts e vínculos corrigidos permanecem históricos.

A ADR 010 é a fonte canônica do algoritmo, das invariantes de escopo e do
tratamento de concorrência. O evaluator só considera o conflito resolvido
quando o snapshot produzido por aquelas regras for `consistent`.

Criar Decision humana sem corrigir o conflito não torna o input consistente e
não autoriza ação dependente daquele Fact.

### Aplicação, staleness e uso único

A aplicação de Decision ocorrerá na mesma transação PostgreSQL da mutação de
domínio, Commercial Event, aplicação registrada e conclusão do Commercial
Command.

Antes da mutação, o sistema deverá:

1. bloquear e carregar subject e estado atuais;
2. confirmar Organization e requested action;
3. confirmar outcome e authority exigidos;
4. recalcular o input fingerprint com a policy registrada;
5. rejeitar qualquer divergência como `decision_stale`;
6. confirmar que a Decision ainda não possui aplicação material;
7. validar novamente a transição da ADR 008;
8. executar a mutação e registrar o vínculo com a Decision.

Uma Decision autoriza no máximo uma aplicação material. Retry com a mesma
Idempotency-Key retorna o recibo existente. Outra chave não autoriza segunda
aplicação e retorna conflito.

Policy nova não torna Decision anterior stale por si só. Staleness é mudança
nos inputs, estados ou referências usados pela versão registrada. Reavaliação
sob policy mais nova é sempre explícita.

### Contratos existentes e enforcement

Os endpoints atuais de criação de Opportunity e transição serão mantidos como
endereços, mas seu contrato passará a exigir Decision Record aplicável. Não
existirá payload legado, feature flag de bypass ou rota paralela.

Testes e cockpit do Épico 02 deverão migrar para o novo contrato no mesmo
conjunto de implementação. Isso é uma breaking change local e deliberada. Não
há consumidor externo autorizado.

### Limites locais e de autenticação

O sistema continuará acessível somente em loopback. `actor_ref`,
`authority_ref` e `executor_ref` não comprovam identidade, papel ou permissão.

Exposição externa, produção, autenticação, autorização real, tenancy seguro ou
delegação de autoridade exigem análise e ADR próprias. Nenhuma limitação local
pode ser omitida da interface, documentação ou Pull Request de adoção.

## Consequências positivas

- Gates deixam de ser opcionais para ações materiais.
- Cada efeito possui Decision específica, atual e auditável.
- Uma Decision não concede autoridade além da intenção avaliada.
- Hard exclusion, exceção, prioridade e unknown permanecem distintos.
- Qualified e estados terminais preservam autoridade humana.
- Nurture recebe somente casos com retorno temporal objetivo.
- Decision stale e dupla aplicação são impedidas na fonte de verdade.
- O caminho legado não pode contornar a policy.
- A máquina da ADR 008 e a idempotência da ADR 009 são preservadas.

## Consequências negativas

- Criação de Opportunity e transições passam a exigir avaliação adicional.
- Contratos internos e E2E existentes precisarão mudar sem período de
  compatibilidade.
- Ações human-only exigem registro explícito mesmo no ambiente local.
- O mantenedor continua sem autenticação real para autoridade humana.
- Policies estritas podem aumentar revisões humanas enquanto os critérios não
  forem refinados por evidência operacional.
- Decision stale pode exigir reavaliação imediatamente antes da aplicação.
- Catálogos fechados exigem nova versão para motivos legítimos ainda não
  previstos.

## Riscos

- **Bypass acidental pelos comandos existentes:** mitigar removendo o contrato
  legado no mesmo rollout e testando rejeição sem Decision.
- **Decision aplicada a ação diferente:** mitigar comparando exatamente a
  requested action e registrando aplicação única.
- **Corrida entre avaliação e mutação:** mitigar com fingerprint, lock e
  revalidação transacional.
- **Human-only executado pelo engine:** mitigar com authority type fechado e
  testes negativos para qualified e terminais.
- **Nurture usado para limpar backlog incompleto:** mitigar exigindo fit,
  timing, data e condição de retorno.
- **Preferência virar desqualificação:** mitigar com matriz explícita e golden
  tests por critério.
- **Reason code genérico esconder decisão:** limitar `other_human_confirmed` a
  lost humano com evidence.
- **Referência humana parecer autenticação:** manter nomenclatura declarativa,
  loopback e proibição de produção.
- **Hard exclusions incorretas por Fact ruim:** exigir provenance, evidence
  aplicável, correção e transição terminal humana.
- **Modelo virar orquestrador:** manter avaliação e aplicação síncronas no
  domínio comercial, sem Case, Run, fila ou runtime universal.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-11. Sua aceitação,
em conjunto com a ADR 010, autoriza a implementação do Épico 03 estritamente
dentro do plano aprovado e dos limites das duas decisões.

A adoção deverá:

1. criar contratos fechados para requested action, outputs, reason codes e
   authority;
2. implementar as policies v1 com a matriz integral e golden tests;
3. persistir Decision antes de qualquer aplicação material;
4. exigir Decision nos contratos existentes sem caminho legado;
5. implementar revalidação transacional e aplicação única;
6. registrar Decisions humanas para qualified e estados terminais;
7. provar conflict resolution sem last-write-wins;
8. atualizar o cockpit e os E2E dos Épicos 02 e 03;
9. preservar todos os testes e serviços da fundação;
10. manter ambiente local, Foundation CI, CEF Governance e Ruleset vigentes.

## Reversão

Depois de aceita e adotada, rollback de aplicação deverá restaurar a última
versão compatível sem apagar Decisions, Facts, aplicações ou Events. Reabrir um
caminho sem Decision não é rollback seguro e exigiria ADR sucessora.

Alterar a máquina, tornar terminal automático, permitir uma Decision para
múltiplas ações, mudar autoridade, remover staleness ou abandonar aplicação
única exige ADR sucessora. Apagar histórico exige autorização destrutiva e a
futura ADR de retenção.

## Referências

- `docs/01-icp.md`
- `docs/02-offer.md`
- `docs/03-commercial-process.md`
- `docs/04-qualification-rules.md`
- `docs/05-agent-behavior.md`
- `docs/06-state-machine.md`
- `docs/adr/008-commercial-domain-model-and-lifecycle.md`
- `docs/adr/009-commercial-audit-idempotency-and-external-identity.md`
- `docs/adr/010-commercial-fact-policy-and-decision-model.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/api-contracts.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/data-and-migrations.md`
- `docs/engineering/standards/security.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
