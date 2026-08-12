# ADR 014 — Deterministic Evidence Alignment for Commercial Interpretation

- **Status:** Accepted
- **Data:** 2026-08-12
- **Responsável:** Cognita
- **Substitui:** ADR 012 parcialmente, apenas na origem e na resolução dos offsets de Evidence
- **Substituída por:** nenhuma

## Contexto

A ADR 012 definiu a fronteira não autoritativa de interpretação comercial, com
Interpretation Runs, Fact Candidates, Evidence Spans e resoluções humanas. Ela
também determinou que Evidence referencia intervalos imutáveis de uma Message
autoritativa por offsets em Unicode code points e digest SHA-256.

O benchmark sintético registrado na ADR 013 demonstrou que exigir do provider
os offsets finais de Evidence mistura duas responsabilidades diferentes:
interpretação semântica e alinhamento mecânico no texto autoritativo. Modelos
podem identificar corretamente um trecho literal e ainda produzir índices
inconsistentes com a convenção de code points, especialmente diante de acentos,
emoji, surrogate pairs e caracteres combinados.

O servidor já possui a Message autoritativa e consegue executar busca literal,
validação de unicidade, derivação de offsets e digest de forma determinística.
A interpretação do provider pode, portanto, limitar-se a propor um trecho
literal transitório, sem receber autoridade sobre a localização persistida.

Esta ADR sucede parcialmente a ADR 012 somente na origem e na resolução dos
offsets de Evidence. Todas as demais decisões da ADR 012 continuam válidas,
inclusive o modelo de dados
persistido, os limites de autoridade, o fluxo de confirmação, a minimização de
dados e a separação entre Candidate e Commercial Fact.

A ADR 013 permanece `Proposed`, sem modelo selecionado. Esta decisão não escolhe
provider, modelo, credencial, configuração de API ou baseline de privacidade.

## Problema

Como transformar um trecho literal proposto pelo provider em Evidence
persistível, com offsets e digest corretos e auditáveis, sem confiar ao modelo
aritmética de índices, sem heurísticas de alinhamento e sem permitir que texto
não confiável altere autoridade, Policy, Decision ou estado de domínio?

## Restrições

- A Message persistida no PostgreSQL permanece a única fonte textual
  autoritativa do run.
- O provider não emitirá `startOffset`, `endOffset` ou `spanDigest`.
- A persistência de Evidence continuará contendo `messageId`, `startOffset`,
  `endOffset`, `spanDigest` e `evidenceType`; não haverá alteração de schema.
- Offsets continuarão usando intervalos `[startOffset, endOffset)` em Unicode
  code points, nunca índices UTF-16 implícitos do runtime.
- Busca e comparação serão literais, exatas e sem normalização Unicode,
  autocorreção, fuzzy matching ou inferência contextual.
- Nenhuma ocorrência mais recente, primeira, última ou escolhida pelo modelo
  vencerá quando houver múltiplas correspondências.
- Evidence inválida nunca criará Evidence válida, Commercial Fact, autoridade,
  Policy, Decision ou ação material.
- `ambiguous` continuará representando ambiguidade semântica; falha mecânica de
  alinhamento será `invalid` com código categórico próprio.
- `duplicate` dependerá exclusivamente do estado persistente e será calculado
  pelo sistema depois da validação semântica e do alinhamento de Evidence.
- O texto integral da Message, o trecho proposto e o output integral não serão
  copiados para Candidate, Evidence, evento, ledger ou log.
- Não haverá confidence, score, tools, execução de ação ou mecanismo de
  autoridade no structured output.
- Esta decisão não autoriza por si só benchmark v2, chamada externa, migration,
  implementação ou alteração de produto.

## Alternativas consideradas

### Manter offsets produzidos pelo provider

Preservaria literalmente o contrato original da ADR 012, mas manteria no
componente probabilístico uma operação mecânica que o servidor consegue
realizar sobre a fonte de verdade. Rejeitada porque o benchmark demonstrou
falhas de alinhamento mesmo quando o trecho semanticamente correto foi
identificado.

### Aceitar a primeira ou a última ocorrência literal

Produziria um intervalo sempre que o trecho aparecesse ao menos uma vez, porém
uma escolha por posição não prova qual ocorrência sustenta a interpretação.
Rejeitada por criar Evidence falsa de forma silenciosa.

### Solicitar ao provider um índice de ocorrência ou contexto adicional

Poderia distinguir repetições, mas recolocaria no provider a responsabilidade
por desambiguação mecânica e ampliaria o contrato antes de existir necessidade
comprovada. Rejeitada no v1. Repetições indistinguíveis serão inválidas.

### Usar normalização Unicode, fuzzy matching ou autocorreção

Poderia aumentar a taxa de correspondência, mas permitiria que texto diferente
do conteúdo autoritativo fosse tratado como Evidence exata. Rejeitada porque
introduz heurística, reduz auditabilidade e torna offsets dependentes de uma
transformação adicional.

### Persistir `evidenceQuote`

Facilitaria diagnóstico direto do output, mas duplicaria conteúdo já presente
na Message e ampliaria retenção de dados textuais. Rejeitada porque não existe
necessidade concreta: Evidence válida é recuperável pela Message e pelos
offsets; falhas são auditadas por código categórico e digest do output do run.

### Derivar offsets deterministicamente a partir de trecho literal transitório

Separa interpretação semântica de alinhamento mecânico, preserva a Message como
fonte de verdade e permite falhar de forma fechada quando a correspondência não
for única. É a alternativa selecionada.

## Decisão

O provider emitirá um `evidenceQuote` literal e
transitório para cada proposta. O servidor derivará Evidence exclusivamente a
partir da Message autoritativa vinculada ao Interpretation Run.

### Contrato estruturado mínimo do provider

Cada item do structured output conterá somente:

- `factKey` do catálogo fechado vigente;
- `proposedValue`, compatível com o schema do Fact, quando houver valor exato;
- `classification`, limitada no provider a `reviewable` ou `ambiguous`;
- `ambiguityCode` e `ambiguityDetails` permitidos quando a classificação for
  `ambiguous`;
- `evidenceQuote`, como substring literal não vazia da Message.

Nesse contrato, `classification` é uma proposta semântica do provider, não a
classificação final persistida. O provider não emitirá:

- offsets ou digest de Evidence;
- `invalid` ou `duplicate`;
- IDs de Message, Organization, Lead ou recursos técnicos;
- Decision, Policy, autoridade, executor ou estado persistente;
- `correctsFactIds`, confidence, score ou ações;
- instruções para tools ou efeitos externos.

O envelope continuará sujeito a JSON Schema strict, Zod e catálogos fechados.
Violação estrutural do envelope mantém o comportamento da ADR 012: run
`failed`, código `invalid_structured_output` e nenhum Candidate parcial.

### Algoritmo determinístico de alinhamento

Para cada item estruturalmente válido, o servidor executará, nesta ordem:

1. carregar pelo run a Message imutável e confirmar o mesmo escopo de
   Organization, Lead e Conversation;
2. converter o corpo da Message e `evidenceQuote` em sequências de Unicode code
   points, sem normalização ou transformação;
3. rejeitar quote vazio por `evidence_quote_empty`;
4. enumerar todas as ocorrências literais, inclusive sobrepostas, da sequência
   do quote na sequência da Message;
5. se houver zero ocorrência, classificar o Candidate como `invalid` com
   `evidence_quote_not_found` e não criar Evidence;
6. se houver duas ou mais ocorrências, classificar o Candidate como `invalid`
   com `evidence_quote_multiple_matches` e não criar Evidence;
7. se houver exatamente uma ocorrência, derivar `startOffset` inclusivo e
   `endOffset` exclusivo nas posições da sequência de code points;
8. reextrair a sequência `[startOffset, endOffset)` da Message e exigir
   igualdade exata, code point a code point, com `evidenceQuote`;
9. calcular `spanDigest` como SHA-256 dos bytes UTF-8 do trecho reextraído;
10. criar Evidence com a Message do run, os offsets derivados, o digest e
    `evidenceType = message_text_span`;
11. executar as demais validações semânticas locais da ADR 012;
12. somente depois consultar o estado persistente necessário para classificar
    duplicidade conforme a ADR 012.

O algoritmo não usa timestamp, ordem de inserção, ordem das ocorrências, índice
sugerido, modelo, heurística ou semelhança. Portanto, múltiplas ocorrências
indistinguíveis sempre produzem o mesmo resultado inválido e nenhuma delas
participa de Evidence. Essa regra distingue falha mecânica de alinhamento de
ambiguidade semântica.

A unidade de offset é a posição na sequência de Unicode code points. Nenhuma
posição intermediária em UTF-16 pode ser persistida. A comparação é binária no
nível da sequência de code points: formas visualmente equivalentes com
composição Unicode diferente não correspondem sem igualdade literal.

### Responsabilidade pelas classificações

A classificação persistida possui autoridade dividida de forma explícita:

| Classificação | Responsável pela determinação | Significado |
|---|---|---|
| `reviewable` | provider propõe; sistema valida | proposta semântica exata, com valor e Evidence válidos |
| `ambiguous` | provider propõe; sistema valida | significado semanticamente indeterminado conforme catálogo fechado |
| `invalid` | sistema | item viola schema semântico, catálogo, tipo, valor, Evidence ou invariantes locais |
| `duplicate` | sistema | item válido é equivalente a Candidate canônico segundo estado persistente |

Os códigos semânticos de ambiguidade permanecem os da ADR 012:

- `numeric_range`;
- `uncertain_language`;
- `multiple_possible_values`;
- `unclear_negation`;
- `insufficient_context`.

Os códigos de alinhamento introduzidos por esta decisão são categóricos e não
semânticos:

- `evidence_quote_empty`;
- `evidence_quote_not_found`;
- `evidence_quote_multiple_matches`;
- `evidence_quote_round_trip_mismatch`.

`evidence_quote_round_trip_mismatch` protege a invariante de reextração e
indica defeito ou divergência interna; ele não autoriza busca alternativa.
Candidates inválidos não são confirmáveis e não produzem Evidence falsa ou
Commercial Fact. Ausência de proposta inferível continua sendo ausência de
Candidate e, consequentemente, `unknown` no snapshot de Facts da ADR 010.

Expressões de ausência de conhecimento, como “não sei”, “não tenho essa
informação” ou “preciso confirmar”, não produzem valor nem Candidate. `unknown`
continua sendo exclusivamente ausência de Commercial Fact autoritativo.

O lifecycle derivado da ADR 012 não muda: `reviewable` validado permanece
elegível a `pending_confirmation`; `ambiguous`, `invalid` e `duplicate`
permanecem não confirmáveis; resoluções humanas válidas continuam sendo o único
caminho para `confirmed` ou `rejected`.

### Segurança e autoridade

Message e `evidenceQuote` são dados não confiáveis. Seu conteúdo não pode:

- alterar provider, modelo, instruction key, instruction version ou output
  schema;
- introduzir Fact key fora do catálogo ou mudar schema de valor;
- conceder `declared_human`, selecionar Authority ou Executor;
- modificar Policy, Decision, Commercial State ou active Fact snapshot;
- escolher `assert`, `correct` ou `correctsFactIds`;
- invocar tool, integração, canal ou efeito externo.

O provider interpreta texto, o servidor valida e alinha Evidence, e somente o
fluxo humano governado da ADR 012 pode confirmar um Candidate. As limitações de
`declared_human` das ADRs 010 e 011 permanecem inalteradas.

### Persistência e auditoria

`evidenceQuote` existirá somente na resposta transitória do provider durante a
validação. Ele não será persistido nem registrado em log, Commercial Event ou
ledger. Para Evidence válida, o trecho poderá ser reconstruído da Message
autoritativa usando os offsets e verificado pelo digest.

Para item inválido, a auditoria persistirá apenas o código categórico permitido
e os metadados minimizados já autorizados pela ADR 012. O output digest do run
permanece disponível quando aplicável, mas o output e o quote integrais não
serão armazenados.

Esta decisão não altera tabelas, colunas, tipos, retenção da Message ou a fonte
de verdade. A necessidade futura de persistir quote ou contexto de alinhamento
exigirá evidência concreta e nova decisão arquitetural.

### Relação com as ADRs 012 e 013

A ADR 012 permanece `Accepted`. Esta ADR a substitui parcialmente somente
nestes pontos:

- o provider emitirá `evidenceQuote` em vez de offsets e digest;
- o servidor será a única autoridade para resolver o trecho literal em
  offsets de code points e `spanDigest`;

Como explicitação compatível com as validações determinísticas já definidas na
ADR 012, `invalid` e `duplicate` serão sempre classificações calculadas pelo
sistema, não valores aceitos do provider. Isso não altera seu significado, seu
lifecycle ou suas regras persistentes.

Continuarão vigentes todas as demais decisões da ADR 012, inclusive entidades,
schema persistido, atomicidade, idempotência, lifecycle derivado, confirmação,
rejeição, correção, Requirement IDs, Question Candidates, auditoria,
minimização, ausência de confidence e separação entre interpretação e Facts.

A ADR 013 continua `Proposed` e sem modelo selecionado. A decisão humana que
aceitou esta ADR autorizou separadamente o benchmark v2, mas não implementação
do Épico 04. Dataset, harness e as 80 chamadas permanecem limitados ao plano
específico do benchmark autorizado.

## Consequências positivas

- Operações mecânicas passam a ser executadas sobre a fonte de verdade por
  lógica determinística.
- O provider deixa de precisar reproduzir a convenção de offsets Unicode.
- Evidence válida sempre corresponde exatamente a um único trecho da Message.
- Repetições, divergências Unicode e ausência de trecho falham de forma fechada
  e auditável.
- O schema persistido e a minimização de texto permanecem inalterados.
- A fronteira entre proposta probabilística e validação autoritativa fica mais
  explícita.
- O contrato do provider fica menor e exclui classificações dependentes do
  estado persistente.

## Consequências negativas

- Trecho repetido, mesmo semanticamente correto, será inválido no v1.
- Formas Unicode visualmente equivalentes, mas compostas por code points
  diferentes, não serão alinhadas.
- Uma proposta que dependeria de Evidence não contígua precisará citar um único
  trecho contínuo suficiente ou será rejeitada.
- O sistema precisará manter conversão e busca explícitas em code points em vez
  de usar métodos de índice nativos de JavaScript.
- A relação de precedência parcial exigirá consultar esta ADR junto da ADR 012
  depois de aceita.
- Não persistir o quote limita análise forense direta de um item inválido ao
  código, metadados e digest disponíveis.

## Riscos

- **Correspondência múltipla frequente:** pode reduzir recall; mitigar medindo
  resultados antes de propor qualquer desambiguação adicional.
- **Erro de unidade de offset:** pode corromper Evidence ao converter code
  points para UTF-16; mitigar com round-trip obrigatório e testes específicos.
- **Normalização acidental:** bibliotecas ou preprocessamento podem modificar o
  texto; mitigar proibindo transformação e testando formas compostas e
  decompostas.
- **Double encoding no digest:** representações diferentes podem produzir hash
  divergente; mitigar definindo SHA-256 sobre bytes UTF-8 do trecho reextraído.
- **Confusão entre `ambiguous` e `invalid`:** pode permitir revisão indevida;
  mitigar com ownership fechado das classificações e códigos distintos.
- **Quote usado como instrução:** conteúdo malicioso pode tentar influenciar o
  sistema; mitigar tratando Message e quote exclusivamente como dados, sem
  tools ou autoridade.
- **Mudança material disfarçada:** a proposta pode ser interpretada como
  autorização de implementação ou benchmark; mitigar com gates explícitos de
  aceitação e autorização separados.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-12. A mesma decisão
autorizou separadamente o benchmark v2, sem autorizar implementação do Épico
04. A adoção de produto ainda depende de autorização futura e deverá, no
mínimo:

1. atualizar o relacionamento histórico da ADR 012 sem reescrever sua decisão;
2. implementar o contrato transitório mínimo e o algoritmo exatamente na
   fronteira de interpretação comercial;
3. manter inalterado o schema persistido de Evidence;
4. provar busca, offsets, round-trip e digest com ASCII, `á`, `ã`, `ç`, emoji,
   surrogate pairs, múltiplos emoji, combining marks, texto antes e depois de
   emoji, substring repetida e ocorrências sobrepostas;
5. provar que zero ou múltiplas ocorrências não criam Evidence nem Fact;
6. provar que `invalid` e `duplicate` não são aceitos do provider;
7. executar os gates do CEF e as regressões das ADRs 010–012.

A aceitação desta ADR não seleciona modelo. O benchmark v2 possui escopo,
dataset, acceptance bar e autorização humana próprios e deverá manter a ADR
013 como `Proposed` até nova decisão humana.

## Reversão

Como nenhuma implementação de produto foi autorizada por esta decisão, a
reversão documental anterior à adoção pode restaurar a relação histórica e
preservar esta ADR como decisão substituída ou rejeitada por ADR sucessora.

Depois de adotada, qualquer retorno a offsets produzidos pelo provider
ou introdução de desambiguação heurística exigirá ADR sucessora. A reversão
operacional deverá preservar Messages, Candidates, Evidence e histórico já
persistidos; não poderá recalcular silenciosamente Evidence antiga ou alterar
Facts e Decisions derivados de confirmações humanas válidas.

## Referências

- `docs/adr/010-commercial-fact-policy-and-decision-model.md`
- `docs/adr/011-decision-gated-commercial-actions-and-human-authority.md`
- `docs/adr/012-commercial-interpretation-boundary-and-candidate-evidence-model.md`
- `docs/adr/013-external-language-model-processing-and-privacy-baseline.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/documentation.md`
- `docs/engineering/standards/security.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
