# ADR 015 — Complete Commercial Requirement Catalog

- **Status:** Accepted
- **Data:** 2026-08-12
- **Responsável:** Cognita
- **Substitui:** ADR 011 parcialmente, somente no catálogo fechado de requirement IDs
- **Substituída por:** nenhuma

## Contexto

A ADR 011 define a Policy v1, seus requisitos estáveis e a matriz que distingue
informação ausente de hard exclusion, revisão humana e prioridade. A ADR 012
exige que `missingRequirements` contenha exclusivamente requirement IDs do
catálogo fechado, nunca Fact keys.

A auditoria preparatória do Épico 04 encontrou uma lacuna entre essas decisões.
`company_ownership_type` é Fact obrigatório para o fit completo e sua ausência
produz `require_information`, mas o catálogo vigente não possui requirement ID
capaz de representar essa ausência. O código atual usa a própria Fact key, o
que a ADR 012 exige remover antes de introduzir Question Candidates.

Esta decisão sucede parcialmente a ADR 011 somente para completar seu catálogo
de requirement IDs. A ADR 012 permanece válida e não é semanticamente alterada.
As ADRs 010, 013 e 014 também permanecem inalteradas.

## Problema

Como representar canonicamente a ausência de `company_ownership_type` em
`missingRequirements`, preservando integralmente a Policy v1 e garantindo que
todo Fact obrigatório capaz de produzir `require_information` possua um
requirement ID semanticamente válido?

## Restrições

- Adicionar somente `company_ownership_type_known` ao catálogo fechado.
- Não alterar hard exclusions, standard fit, human review ou thresholds.
- Não alterar precedência, outcomes, autoridade ou Commercial State.
- Não alterar Candidate, Evidence, Interpretation Run ou Question Candidate.
- Não criar relação bijetiva obrigatória entre Facts e requirements.
- Preservar mapeamentos agrupados semanticamente intencionais.
- A aceitação desta ADR não altera, por si só, código, schema, migration ou
  template; a adoção depende do plano e da autorização do Épico 04.

## Alternativas consideradas

### Manter a Fact key em `missingRequirements`

Preservaria o comportamento atual, mas violaria diretamente a ADR 012 e
continuaria misturando representação interna de Fact com contrato de requisito.
Rejeitada.

### Omitir a ausência de `company_ownership_type`

Evitaria ampliar o catálogo, porém faria um Fact obrigatório produzir
`require_information` sem requisito explicável e impediria a projeção
determinística correspondente. Também mudaria a semântica observável da Policy.
Rejeitada.

### Reutilizar um requirement ID existente

Reduziria o catálogo, mas nenhum ID vigente representa o conhecimento sobre o
tipo de propriedade. Usar `facts_are_consistent`, `sales_process_known` ou outro
ID produziria significado incorreto. Rejeitada.

### Criar um requirement ID para toda Fact key

Produziria uma relação uniforme, mas substituiria mapeamentos agrupados já
aprovados, como `seller_count → sales_capacity_known`, e ampliaria o escopo sem
necessidade. Rejeitada.

### Completar somente o gap comprovado

Adiciona uma representação semanticamente exata, preserva todos os demais
mapeamentos e permite cumprir a ADR 012 sem alterar a Policy. Selecionada.

## Decisão

Adicionar ao catálogo fechado de requirements v1 exclusivamente:

`company_ownership_type_known`

O mapeamento canônico será:

`company_ownership_type → company_ownership_type_known`

`company_ownership_type_known` significa somente que o valor de
`company_ownership_type` é conhecido por um Commercial Fact ativo e válido.
Não significa empresa privada, fit positivo, standard fit, aprovação,
qualificação nem ausência de hard exclusion.

Assim:

- `private`, `public`, `government`, `nonprofit` e `other` satisfazem o
  requisito de conhecimento;
- ausência de Fact ativo mantém `company_ownership_type_known` em
  `missingRequirements`;
- conflito continua submetido à precedência de `facts_consistent` e a
  `require_human_review`;
- a avaliação do valor conhecido continua pertencendo integralmente à matriz
  da Policy v1 da ADR 011.

### Invariante de totalidade semântica

Todo requisito factual obrigatório capaz de produzir `require_information`
deve possuir uma representação canônica válida em `missingRequirements`.

Essa propriedade exige totalidade semântica do mapeamento aplicável, não uma
bijeção entre Fact keys e requirement IDs. Mapeamentos agrupados permanecem
válidos quando seu significado for o requisito aprovado.

### Catálogo completo de requirement IDs v1

Com a adição adotada, o catálogo fechado contém:

- `lead_is_open`;
- `opportunity_does_not_exist`;
- `contact_has_reachable_channel`;
- `facts_are_consistent`;
- `company_ownership_type_known`;
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

Todos os IDs, exceto `company_ownership_type_known`, permanecem exatamente
como definidos pela ADR 011.

### Auditoria dos Facts obrigatórios

Os Facts obrigatórios capazes de produzir `require_information` e seus
mapeamentos completos são:

| Fact obrigatório | Requirement ID canônico |
|---|---|
| `company_ownership_type` | `company_ownership_type_known` |
| `has_existing_sales_process` | `sales_process_known` |
| `uses_crm` | `crm_usage_known` |
| `seller_count` | `sales_capacity_known` |
| `commercial_owner_defined` | `commercial_owner_known` |
| `has_recurring_inbound` | `recurring_inbound_known` |
| `monthly_lead_volume` | `lead_volume_known` |
| `average_ticket_brl_cents` | `average_ticket_known` |
| `measures_conversion` | `conversion_measurement_known` |
| `roi_provable_within_90_days` | `roi_measurement_known` |
| `pain_confirmed` | `pain_confirmed_with_evidence` |
| `pain_recurring` | `pain_recurring_with_evidence` |
| `pain_measurable` | `pain_measurable_with_evidence` |
| `decision_maker_access_confirmed` | `decision_maker_access_known` |
| `budget_confirmed` | `budget_known` |
| `operational_capacity_confirmed` | `operational_capacity_known` |
| `timing_status` | `timing_known` |
| `revisit_at` | `nurture_revisit_date_known` |
| `nurture_return_condition` | `nurture_return_condition_known` |

`sales_cycle_days` não é obrigatório para uma decisão e sua ausência não
produz `require_information`; a ADR 011 o define somente como sinal de
prioridade. Portanto, ele não exige requirement ID nesta proposta.

A auditoria não encontrou outro Fact obrigatório sem requirement ID válido.

### Limites da substituição parcial

Esta ADR substitui a ADR 011 apenas na composição do catálogo fechado, pela
adição de `company_ownership_type_known`, e no mapeamento correspondente. Todas
as demais decisões da ADR 011 permanecem vigentes, inclusive:

- hard exclusions;
- standard fit e critérios de revisão humana;
- thresholds e precedência;
- reason codes e outcomes;
- autoridade e limites de `declared_human`;
- nurture, terminalidade e máquina da ADR 008.

A ADR 012 continua sendo a fonte canônica da exigência de requirement IDs em
`missingRequirements` e da projeção futura de Question Candidates.

## Consequências positivas

- A representação de `missingRequirements` torna-se semanticamente total para
  os Facts obrigatórios da Policy v1.
- A ausência de ownership deixa de vazar uma Fact key no contrato.
- A Policy preserva exatamente seus gates, thresholds e outcomes.
- Question Candidates poderão projetar o requisito sem interpretar Fact keys.
- O escopo permanece limitado ao único gap comprovado.

## Consequências negativas

- O catálogo fechado recebe mais um identificador versionado.
- Consumidores futuros precisarão conhecer o novo requirement ID.
- A ADR 011 registra a relação histórica de substituição parcial.
- Golden tests e contratos precisarão ser atualizados na implementação futura.

## Riscos

- **Confundir conhecimento com fit:** mitigar definindo que qualquer valor
  válido satisfaz o requirement, enquanto a Policy avalia o valor separadamente.
- **Expandir o catálogo por bijeção mecânica:** mitigar exigindo gap semântico
  comprovado e preservando mappings agrupados.
- **Alterar a Policy durante a normalização:** mitigar com regressões que
  comparem outcome, reason codes, precedência e thresholds antes e depois.
- **Question Candidate virar ação ou canal:** manter a projeção determinística,
  não persistida e sem envio, conforme a ADR 012.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-12. A mesma decisão
autoriza sua adoção no Épico 04, somente depois da integração desta ADR em
`main` e dentro do plano aprovado.

A adoção deverá:

1. atualizar a relação histórica da ADR 011 sem reescrever sua decisão;
2. acrescentar o requirement ID ao schema fechado;
3. implementar o mapeamento determinístico aprovado;
4. impedir Fact keys cruas em `missingRequirements`;
5. adicionar regressões para ownership ausente e conhecido;
6. provar que nenhum outcome, threshold, reason code ou gate mudou;
7. somente então retomar o Épico 04 sob autorização humana explícita.

Uma futura projeção poderá associar `company_ownership_type_known` a um template
como “Qual é o tipo de propriedade da empresa?”, mas esta decisão não cria nem
altera templates.

## Reversão

Antes da adoção no produto, uma reversão exige ADR sucessora e restauração do
catálogo anterior sem mudanças em dados, pois esta decisão ainda não produziu
estado persistido.

Depois da adoção, substituição do ID ou alteração de sua semântica
exige ADR sucessora. Rollback de aplicação deverá preservar Decision Records
históricos e não poderá reintroduzir Fact keys cruas em novos outputs. Decisions
já persistidas continuam imutáveis conforme as ADRs 010 e 011.

## Referências

- `docs/adr/010-commercial-fact-policy-and-decision-model.md`
- `docs/adr/011-decision-gated-commercial-actions-and-human-authority.md`
- `docs/adr/012-commercial-interpretation-boundary-and-candidate-evidence-model.md`
- `docs/adr/013-external-language-model-processing-and-privacy-baseline.md`
- `docs/adr/014-deterministic-evidence-alignment.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/documentation.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
