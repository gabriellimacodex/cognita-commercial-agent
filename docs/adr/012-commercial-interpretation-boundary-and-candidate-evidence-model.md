# ADR 012 — Commercial Interpretation Boundary and Candidate Evidence Model

- **Status:** Accepted
- **Data:** 2026-08-12
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** ADR 014 (substituição parcial limitada à origem e à resolução dos offsets e do digest de Evidence)

## Contexto

As ADRs 008 e 009 estabeleceram Conversation, Message, auditoria e
idempotência no domínio comercial. As ADRs 010 e 011 estabeleceram Commercial
Facts imutáveis, snapshots ativos sem last-write-wins, policies determinísticas,
Commercial Decisions auditáveis e limites explícitos para autoridade humana.

O Épico 04 pretende interpretar conteúdo textual de uma única Message e
produzir Evidence e propostas estruturadas de Facts. O modelo vigente não
permite que inferência de IA seja provenance de Commercial Fact nem que IA
conceda autoridade, satisfaça Policy, resolva conflito ou execute ação material.
Portanto, a interpretação precisa existir em uma fronteira não autoritativa
entre Message e Commercial Fact.

A RFC-0001 reconhece um protocolo conceitual de coordenação, mas proíbe derivar
dele runtime, package, banco ou orquestrador universal sem evidência em dois
domínios. A solução do Épico 04 deve permanecer específica do domínio comercial
e possuir somente os consumidores concretos do vertical slice aprovado.

## Problema

Como representar uma interpretação de linguagem, sua Evidence e seus Fact
Candidates de forma auditável e idempotente, permitindo confirmação ou rejeição
humana sem transformar output de modelo em Fact, autoridade, Policy ou ação
comercial?

## Restrições

- PostgreSQL permanece a fonte de verdade de Messages, Interpretation Runs,
  Candidates, resoluções e Commercial Facts.
- Message permanece imutável e é a única fonte textual interpretada por um run.
- Candidate nunca é Commercial Fact e não participa do active Fact snapshot.
- IA não pode criar Fact autoritativo, decidir `assert` ou `correct`, resolver
  conflito, conceder autoridade ou executar ação material.
- Confirmação e correção exigem `declared_human`; essa referência permanece
  declarativa e local, conforme as ADRs 008 e 011.
- Commercial Facts, correções e conflitos continuam obedecendo integralmente à
  ADR 010.
- Commercial Decisions e aplicação de ações continuam obedecendo integralmente
  à ADR 011.
- O fluxo v1 será síncrono, com persistência anterior à chamada externa.
- Não haverá retry automático, fallback, segundo modelo, fila, worker ou
  scanner de recuperação no v1.
- Não haverá confidence, probability, likelihood, certainty score ou score
  comercial.
- Structured output será obrigatório e toda saída será validada por schema e
  por regras determinísticas.
- Question Candidates serão projeções determinísticas, não persistidas, não
  geradas por LLM e não enviadas a canais.
- Offsets de Evidence usarão Unicode code points e nunca índices UTF-16
  implícitos do runtime.
- Nenhuma decisão desta ADR autoriza provider, credencial ou tratamento externo
  de dados; essa decisão pertence à ADR 013.
- Esta proposta não autoriza migrations ou implementação enquanto estiver
  `Proposed`.

## Alternativas consideradas

### Permitir que a IA grave Commercial Facts diretamente

Reduziria o número de etapas, mas atribuiria autoridade a uma inferência
probabilística, contornaria a provenance fechada da ADR 010 e permitiria que um
erro alterasse Policy e ações materiais. Rejeitada.

### Representar interpretação em `commercial_events`

Reutilizaria a trilha existente, mas contrariaria a ADR 009: Commercial Event é
audit trail, não fonte de verdade nem armazenamento genérico de estado. Também
misturaria execução, Candidates e resolução. Rejeitada.

### Usar somente estado mutável no Candidate

Uma coluna atualizada de `pending` para `confirmed` ou `rejected` seria simples,
mas apagaria a distinção entre classificação original e decisão humana.
Rejeitada em favor de Candidate imutável, resolução append-only e status público
derivado.

### Tratar todo output parseável como Candidate confirmável

Ocultaria ambiguidade, Evidence inválida e duplicidade. Rejeitada. O output
precisa passar por schema estrito e validação determinística antes de qualquer
confirmação.

### Persistir confidence numérica

Poderia ordenar Candidates, mas não existe calibração por Fact key, idioma,
modelo ou distribuição operacional. Um valor não calibrado criaria falsa
precisão e poderia virar gate implícito. Rejeitada no v1.

### Gerar Question Candidates pelo modelo

Permitiria texto mais flexível, mas faria a próxima pergunta depender de output
probabilístico e duplicaria a autoridade de `missingRequirements`. Rejeitada.
Questions serão projeções de requirement IDs estáveis e templates versionados.

### Executar interpretação em BullMQ

Reutilizaria infraestrutura da fundação, mas introduziria estado assíncrono,
recovery e redelivery sem necessidade comprovada para uma chamada limitada a
20 segundos. Rejeitada no v1. A ADR 006 continua específica para foundation
jobs.

### Usar offsets nativos de string JavaScript

Seria conveniente, porém JavaScript indexa strings em code units UTF-16. Emoji,
surrogate pairs e caracteres combinados tornariam Evidence incorreta.
Rejeitada em favor de code points Unicode com conversão explícita.

### Criar package ou framework universal de IA

Anteciparia reuso hipotético e contrariaria a ADR 005, o padrão de arquitetura
e a RFC-0001. Rejeitada. O módulo permanecerá na API enquanto ela for o único
consumidor.

## Decisão

Adotar uma fronteira comercial de interpretação composta por Interpretation
Run, Fact Candidate, Evidence Span e Candidate Resolution. Esses conceitos são
específicos do domínio comercial e não alteram as fontes de verdade definidas
pelas ADRs 008–011.

### Fluxo governado

O fluxo aprovado será:

1. carregar uma Message inbound imutável;
2. criar e confirmar um Interpretation Run `running` no PostgreSQL;
3. concluir idempotentemente o comando de criação do run;
4. realizar uma única chamada síncrona ao provider definido pela ADR 013;
5. validar structured output e cada Evidence Span;
6. finalizar o run como `completed`, persistindo Candidates e spans na mesma
   transação, ou como `failed`, sem Candidates parciais;
7. apresentar Candidates para revisão;
8. confirmar ou rejeitar por comando humano explícito;
9. criar Commercial Fact somente durante confirmação válida;
10. reavaliar Commercial Decision somente por comando explícito existente.

Nenhuma etapa entre 1 e 7 altera Commercial Facts, active Fact snapshot,
Commercial Decision ou Commercial State.

### Interpretation Run

Interpretation Run representa uma única tentativa de interpretar exatamente
uma Message. Ele deverá referenciar a mesma Organization, Lead, Conversation e
Message e registrar, no mínimo:

- ID técnico;
- `organization_id`, `lead_id`, `conversation_id` e `message_id`;
- status `running`, `completed` ou `failed`;
- `idempotency_key` e `request_hash` sem persistir request integral;
- provider, model snapshot, instruction key, instruction version e instruction
  digest planejados;
- output schema version;
- provider request ID, duração e usage, quando retornados;
- output digest, quando houver output válido;
- failure code sanitizado, quando falhar;
- referência opcional ao run que motivou reprocessamento;
- timestamps atribuídos pelo PostgreSQL.

As únicas transições serão `running → completed` e `running → failed`. Estados
terminais não regridem. Candidate e Evidence são persistidos somente na
transição atômica para `completed`.

Cada run admite exatamente uma model invocation no v1. Seus metadados ficam no
próprio run; não haverá entidade ou tabela separada de invocation enquanto não
existirem retry, fallback ou múltiplas chamadas autorizadas.

O run deve ser confirmado no banco antes de qualquer transmissão externa. O
comando `start_commercial_interpretation` usa a idempotência da ADR 009 para
criar o recurso e o evento `commercial_interpretation_started` em uma transação
curta. A chamada externa ocorre depois do commit. O recibo do comando aponta
para o mesmo run.

Replay da mesma Idempotency-Key e mesmo hash retorna o run existente e nunca
invoca novamente o provider. Mesma chave com hash diferente retorna `409`.
Falha de processo após o commit pode deixar um run `running`; o v1 não tenta
novamente de forma silenciosa. Reprocessamento exige comando explícito, nova
Idempotency-Key e novo run ligado pelo campo de reprocessamento. Diagnóstico ou
tratamento operacional de um run abandonado não autoriza nova chamada nem muda
Commercial Facts ou os estados aprovados nesta decisão.

### Structured output e Extraction Result

O output do provider será validado por JSON Schema strict e novamente por Zod
e regras semânticas locais. O schema deverá:

- aceitar somente Fact keys do catálogo vigente;
- limitar quantidade de Candidates e Evidence Spans;
- discriminar tipos de valor compatíveis com o catálogo;
- exigir classificação, Evidence offsets e códigos fechados;
- usar `additionalProperties: false` em objetos;
- não aceitar provider, model, Message ID, Organization, Authority, Policy,
  status persistente ou IDs técnicos definidos pela Message ou pelo modelo.

Completed run, Candidates e Evidence Spans formam o Extraction Result. Não será
criada tabela adicional para um conceito sem comportamento próprio.

Se o envelope não obedecer ao schema, o run será `failed` com código
`invalid_structured_output`; nenhum Candidate será persistido. Um item que
passar pelo envelope, mas falhar em validação semântica determinística de valor,
duplicidade ou Evidence, poderá ser preservado como Candidate `invalid` ou
`duplicate`, sem se tornar confirmável.

### Instruction versioning

Instruções serão artefatos versionados no código da API, com key, versão exata
e digest SHA-256. Uma versão publicada não muda semanticamente. Alteração de
regra, catálogo ou significado cria nova versão e mantém a anterior
identificável para auditoria.

Não será criada plataforma de prompt management, tabela editável, seleção por
usuário ou instrução originada da Message.

### Fact Candidate

Fact Candidate é proposta imutável e não autoritativa. Ele conterá, no mínimo:

- ID, Organization, Lead, run e source Message;
- Fact key e Fact schema version;
- tipo e valor proposto validados, quando existir valor exato;
- classificação inicial;
- ambiguity code e detalhes estruturados permitidos, quando aplicável;
- validation code, quando inválido;
- referência ao Candidate equivalente, quando duplicado;
- timestamp atribuído pelo PostgreSQL.

As classificações fechadas v1 serão:

- `reviewable`;
- `ambiguous`;
- `invalid`;
- `duplicate`.

Não haverá confidence numérica. Ausência de Fact inferível não cria Candidate
`unknown`: unknown continua sendo ausência de Commercial Fact ativo conforme a
ADR 010. Um Candidate booleano `false` é uma proposta conhecida e distinta de
ausência, ambiguidade ou conflito.

### Evidence Span

Evidence Span é referência imutável a um intervalo da Message do run. Ele
conterá:

- Candidate e Message IDs;
- `evidence_type = message_text_span`;
- `start_offset` inclusivo;
- `end_offset` exclusivo;
- SHA-256 do texto derivado naquele intervalo;
- timestamp atribuído pelo PostgreSQL.

Offsets usam `[startOffset, endOffset)` em Unicode code points. A aplicação
deverá converter explicitamente code points para a representação UTF-16 do
runtime antes de extrair o trecho. O servidor vincula o Message ID ao run; o
modelo não escolhe outra Message. Limites, ordem, digest e pertencimento à mesma
Organization, Lead e Conversation serão validados.

O texto do span não será copiado para Candidate, Commercial Event, log ou
ledger. A Message autoritativa é lida quando a Evidence precisa ser exibida ou
validada.

A adoção deverá provar a conversão e validação com casos distintos para ASCII,
português com acentos, emoji, surrogate pair, combinação de emoji com texto,
offset inválido, offset fora dos limites e digest divergente.

### Ambiguidade

O catálogo fechado `commercial-ambiguity@1.0.0` será:

- `numeric_range`;
- `uncertain_language`;
- `multiple_possible_values`;
- `unclear_negation`;
- `insufficient_context`.

Candidate ambíguo não é confirmável. Um intervalo como “entre 400 e 700” pode
preservar `{ minimum: 400, maximum: 700 }` em detalhes estruturados, mas não
propõe um inteiro exato nem cria Fact. Resolver ambiguidade exige nova
informação autoritativa ou nova declaração humana, não seleção automática de um
valor pelo modelo.

### Duplicidade

Validação determinística identifica equivalência semântica pelo mesmo escopo,
Fact key, Fact schema version, proposed value e Evidence. Duplicatas dentro do
mesmo run ou de reprocessamento permanecem históricas, recebem classificação
`duplicate`, referenciam o Candidate canônico e não são confirmáveis.

Essa classificação não deduplica Commercial Facts. Se um Candidate reviewable
for confirmado por `assert`, a resolução de Facts continua pertencendo à ADR
010.

### Lifecycle derivado

Candidate não possui coluna de status mutável. O status público será derivado:

| Classificação e resolução | Status público |
|---|---|
| `reviewable`, sem resolução | `pending_confirmation` |
| `ambiguous` | `ambiguous` |
| `invalid` | `invalid` |
| `duplicate` | `duplicate` |
| resolução `confirmed` | `confirmed` |
| resolução `rejected` | `rejected` |

Candidate Resolution será append-only e terá cardinalidade máxima de uma por
Candidate. Somente Candidate `reviewable` e ainda não resolvido poderá receber
resolução.

### Confirmação e rejeição

Confirmação e rejeição serão comandos idempotentes conforme a ADR 009. Ambas
exigem `declared_human`, `authority_ref` e `executor_ref` separados. Revisão de
agente, modelo, provider ou processo técnico não satisfaz autoridade humana.

Confirmação oferece dois modos, escolhidos somente pela autoridade humana:

- `assert`: cria novo Commercial Fact autoritativo e pode produzir snapshot
  `conflicting` conforme a ADR 010;
- `correct`: exige Evidence e o conjunto completo dos Commercial Facts ativos
  incompatíveis em `correctsFactIds`, seguindo exatamente lock, comparação de
  conjunto e correção atômica definidos pela ADR 010.

Em ambos os modos, Candidate, Evidence e resolução são validados no mesmo
escopo. O Fact criado usa `source_type = human_declaration`, referencia o
Candidate como source e referencia a Message como Evidence. Candidate nunca é
promovido nem atualizado para virar Fact.

Fact, vínculos de correção, Candidate Resolution, Commercial Event e conclusão
do Commercial Command são atômicos. Replay não cria segundo Fact. A IA nunca
escolhe entre `assert` e `correct`.

O catálogo fechado `commercial-candidate-rejection@1.0.0` será:

- `incorrect_extraction`;
- `insufficient_evidence`;
- `ambiguous_statement`;
- `outdated_information`;
- `duplicate_candidate`;
- `not_applicable`.

Rejeição não modifica Fact, Decision ou Message. O v1 não persiste nota livre;
reason code fechado é a representação integral da rejeição.

### Contradição e correção posterior

Uma Message posterior não vence por timestamp. “Temos cinco vendedores” e “na
verdade agora somos três” produzem Candidates e Evidence independentes. O
segundo Candidate pode indicar uma potencial correção para revisão, mas o
modelo não inativa Fact nem escolhe vencedor.

Confirmação por `assert` pode criar conflito. Confirmação por `correct` somente
resolve o conflito se a autoridade humana fornecer exatamente o conjunto
completo de Facts ativos incompatíveis. Facts corrigidos permanecem históricos
e deixam de participar do snapshot pela regra determinística da ADR 010.

### Requirement IDs canônicos

`missingRequirements` deverá conter exclusivamente IDs estáveis do catálogo da
ADR 011, nunca Fact keys. Essa normalização não altera gates, thresholds,
precedência ou outcome da Policy.

A implementação vigente precisa de correção objetiva nos seguintes pontos
antes de introduzir Question Candidates:

- `packages/schemas/src/commercial.ts` aceita `missingRequirements` como array
  de strings sem catálogo fechado;
- `apps/api/src/commercial/commercial-decision-engine.ts` tipa
  `missingRequirements` como `string[]`;
- o helper `factValue` adiciona diretamente a Fact key ao conjunto de missing;
- o gate de contact já adiciona `contact_has_reachable_channel`, demonstrando
  representação mista no mesmo output;
- golden tests vigentes afirmam Fact keys como missing requirements.

A adoção deverá criar um schema fechado de requirement IDs e uma função
determinística Fact key → requirement ID. Exemplos normativos incluem:

- `uses_crm → crm_usage_known`;
- `seller_count → sales_capacity_known`;
- `measures_conversion → conversion_measurement_known`;
- `budget_confirmed → budget_known`;
- `timing_status → timing_known`.

Todos os demais Facts usarão os requirement IDs já definidos pela ADR 011. A
mudança exige regressão provando que apenas a representação foi normalizada e
que outputs decisórios permanecem semanticamente iguais.

### Question Candidates

Question Candidate será projection/read model determinístico sobre
`missingRequirements` da Decision mais recente aplicável. Ele conterá somente:

- requirement ID;
- question template key e versão;
- texto sintético produzido pelo template fechado;
- referência à Decision de origem.

O catálogo de templates será versionado em código. Question Candidate não será
persistido, não será gerado por LLM, não será enviado a canal e não concederá
permissão para criar outbound Message.

### Relação com o Decision Engine

Interpretation Run, Candidate e Evidence nunca entram no input do Decision
Engine. Somente Commercial Facts confirmados participam do snapshot. Depois de
uma confirmação, reavaliação continua sendo comando explícito e cria nova
Commercial Decision imutável. Nenhuma confirmação aplica ação material.

### Auditoria e minimização

Os event types comerciais aprovados para adoção serão:

- `commercial_interpretation_started`;
- `commercial_interpretation_completed`;
- `commercial_interpretation_failed`;
- `commercial_fact_candidate_created`;
- `commercial_fact_candidate_confirmed`;
- `commercial_fact_candidate_rejected`.

Metadata será allowlisted e conterá somente IDs, Fact key, versões, códigos,
contagens, duração e usage necessários. Não conterá Message body, Evidence text,
proposed value sensível, instrução integral, output integral ou dados pessoais.

## Consequências positivas

- IA fica separada de Facts, Policy, Authority e ações materiais.
- Message e Evidence permanecem auditáveis sem duplicar texto.
- Ambiguidade, invalidade, duplicidade, unknown, false e conflito possuem
  semânticas distintas.
- Confirmação e correção reutilizam as invariantes determinísticas da ADR 010.
- Runs persistidos tornam timeout e falha observáveis.
- Idempotência impede cobrança e interpretação duplicadas por replay HTTP.
- Requirement IDs estáveis permitem Question Candidates independentes de Fact
  keys internas.
- A solução permanece local à API e não cria framework universal.

## Consequências negativas

- O fluxo exige revisão humana antes de qualquer novo Fact.
- A chamada síncrona aumenta a latência do endpoint de interpretação.
- Crash entre persistência e finalização pode deixar run `running` para
  diagnóstico e reprocessamento explícito.
- Candidates e resoluções aumentam armazenamento histórico.
- Code-point offsets exigem conversão cuidadosa no runtime JavaScript.
- Catálogos fechados exigem versionamento deliberado quando surgirem novos
  casos.
- A representação de `missingRequirements` precisa ser normalizada antes das
  Questions.

## Riscos

- **Candidate parecer autoritativo:** mitigar com nomenclatura, contratos,
  interface e impossibilidade técnica de participar do Fact snapshot.
- **Prompt injection produzir ação:** mitigar na ADR 013 com Message como dado
  não confiável, ausência de tools e validação estrita.
- **Evidence apontar trecho incorreto:** validar escopo, code points, limites e
  digest; cobrir ASCII, acentos, emoji e surrogate pairs.
- **Replay causar segunda chamada:** reservar o run e concluir o comando antes
  da chamada; replay apenas lê o run.
- **Run abandonado ser repetido silenciosamente:** proibir retry e exigir novo
  comando de reprocessamento.
- **Correção parcial ocultar conflito:** exigir conjunto completo sob lock pela
  ADR 010.
- **Confirmação concorrente criar dois Facts:** cardinalidade única da resolução
  e serialização transacional.
- **Question Candidate virar outbound:** manter projeção sem endpoint de envio e
  sem integração de canal.
- **Requirement normalization mudar Policy:** golden tests devem provar
  equivalência de outcome, reason codes e gates.
- **Modelo crescer para Commercial Orchestrator:** manter módulos específicos,
  sem Case universal, package, fila ou runtime compartilhado.

## Adoção

Esta ADR somente poderá ser adotada depois de decisão humana explícita que a
marque `Accepted` e da aceitação da ADR 013. A adoção deverá:

1. normalizar `missingRequirements` para requirement IDs com regressão;
2. criar migrations pequenas para runs, Candidates, Evidence e resoluções;
3. implementar schemas fechados e validação code-point;
4. implementar persistência anterior à chamada e lifecycle terminal;
5. implementar confirmação/rejeição atômica pela ADR 010;
6. implementar Question Candidates como projection;
7. testar idempotência, concorrência, falhas, ambiguidade e contradição;
8. preservar integralmente os vertical slices anteriores;
9. executar somente fixtures sintéticas conforme a ADR 013;
10. manter CEF Governance, Foundation CI e Ruleset vigentes.

## Reversão

Antes da aceitação, esta proposta pode ser revisada ou rejeitada sem reversão de
produto. Depois da adoção, conter uma falha significa desabilitar criação de
novos Interpretation Runs e manter leitura de histórico, Candidates, Evidence,
resoluções e Facts já confirmados.

Rollback de aplicação deve preservar os registros imutáveis. Dropar tabelas ou
apagar Message, Candidate, resolução, Fact ou Commercial Event exige autorização
destrutiva e decisão de retenção aplicável. Alterar a fronteira Candidate–Fact,
permitir confirmação automática, adicionar confidence, fila, retry automático
ou Question outbound exige ADR sucessora.

## Referências

- `docs/adr/008-commercial-domain-model-and-lifecycle.md`
- `docs/adr/009-commercial-audit-idempotency-and-external-identity.md`
- `docs/adr/010-commercial-fact-policy-and-decision-model.md`
- `docs/adr/011-decision-gated-commercial-actions-and-human-authority.md`
- `docs/adr/013-external-language-model-processing-and-privacy-baseline.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/api-contracts.md`
- `docs/engineering/standards/data-and-migrations.md`
- `docs/engineering/standards/observability.md`
- `docs/engineering/standards/security.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
