# ADR 008 — Adotar o modelo e o ciclo de vida do domínio comercial

- **Status:** Accepted
- **Data:** 2026-08-10
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

O Épico 01 estabeleceu API, PostgreSQL, worker, fila e cockpit por meio de um
vertical slice estritamente técnico. O Épico 02 pretende criar o primeiro
domínio real da plataforma: o domínio comercial determinístico, ainda sem IA,
score, qualificação automática, canais externos ou automação de próxima ação.

A documentação de produto existente descreve o funil futuro, mas ainda mistura
pessoa, entrada comercial, oportunidade, atividade e resultado. Ela também
lista componentes e entidades futuros que não possuem consumidor autorizado
neste épico. Antes de criar migrations ou código, é necessário definir as
fronteiras, relações, invariantes e ciclos de vida mínimos do domínio.

A tabela `organizations` já existe como preparação estrutural. Conforme a ADR
005, sua presença não implementa resolução de tenant, autorização, Row-Level
Security ou isolamento seguro entre organizações.

## Problema

Qual é o menor modelo de domínio capaz de representar empresa, pessoa, entrada,
conversa, responsabilidade, oportunidade e estado comercial de forma
persistente e auditável, sem antecipar Commercial Engine, automação, IA ou uma
arquitetura universal?

## Restrições

- PostgreSQL permanece a fonte de verdade do domínio.
- `Organization` é somente boundary estrutural neste épico.
- Pessoa não pode ser modelada como Lead.
- Contact deve poder existir sem Lead ou Opportunity.
- Lead deve poder existir sem Company ou Opportunity.
- Um Contact pode originar múltiplos Leads ao longo do tempo.
- Um Lead terá no máximo uma Opportunity neste épico.
- Opportunity será o único owner do Commercial State.
- Domain State não pode conter estado de fila, retry, worker ou agente.
- O fluxo comercial será síncrono e não usará BullMQ ou worker.
- Não criar packages `commercial-domain`, `commercial-engine` ou `ai-engine`.
- Não implementar Meeting, score, qualificação automática ou próxima ação.
- Nenhuma identidade humana declarada será apresentada como autenticada.
- Não implementar canal externo, deploy ou exposição pública.
- Esta proposta não autoriza migrations ou implementação.

## Alternativas consideradas

### Implementar integralmente o catálogo de entidades existente

Criaria de uma vez users, agents, qualifications, decisions, actions,
follow-ups, meetings, prompts, policies e outras entidades futuras. Rejeitada
porque não há comportamento ou consumidor autorizado para essas fronteiras e
porque o catálogo atual é visão futura, não modelo mínimo aprovado.

### Tratar Contact e Lead como a mesma entidade

Reduziria o número de tabelas, mas misturaria identidade relativamente estável
da pessoa com ocorrências comerciais distintas. Impediria representar um
Contact sem demanda e mais de um Lead para a mesma pessoa. Rejeitada.

### Exigir Company para criar Lead

Simplificaria relações B2B, mas impediria registrar uma entrada inbound antes
da empresa ser conhecida e incentivaria empresas fictícias. Rejeitada. Company
será opcional no Lead e somente poderá ser associada por comando explícito.

### Derivar a Company do Lead pelo vínculo atual do Contact

Evitaria uma coluna opcional no Lead, porém confundiria o contexto histórico da
demanda com o vínculo atual e mutável da pessoa. Rejeitada. Os dois vínculos
terão semânticas diferentes e nenhuma alteração será propagada automaticamente.

### Colocar o Commercial State no Lead

Pareceria compatível com interfaces centradas em leads, mas misturaria entrada
a ser avaliada com possibilidade comercial reconhecida. Rejeitada porque nem
todo Lead produz Opportunity e somente a Opportunity percorre o funil.

### Adotar todos os estados comerciais documentados

Preservaria literalmente o funil futuro, mas introduziria estados de reunião
sem entidade Meeting e trataria contato e agendamento como estado durável.
Rejeitada em favor de uma máquina menor com significado verificável.

### Criar um package de domínio compartilhado

Poderia antecipar reuso pelo worker, mas no Épico 02 somente a API executará as
regras comerciais. Rejeitada por não existir segundo consumidor concreto. As
regras ficarão em módulo coeso da API e poderão ser extraídas após evidência.

### Executar o fluxo comercial de forma assíncrona

Reutilizaria BullMQ, mas adicionaria Orchestration State e recovery a mutações
locais que cabem em uma transação PostgreSQL. Rejeitada. A ADR 006 continua
específica para jobs da fundação e não é generalizada pelo domínio comercial.

## Decisão

Adotar um modelo comercial federado e específico, composto pelas entidades e
limites a seguir.

### Organization

`organizations` representa o escopo estrutural ao qual os registros comerciais
se relacionam. Toda entidade comercial raiz terá `organization_id`, e relações
internas deverão impedir associação acidental entre organizações.

Essa integridade relacional não constitui autenticação, autorização, tenant
resolution, RLS ou isolamento seguro. Endpoints permanecerão somente em
loopback. Qualquer isolamento real exige análise e ADR futura.

### Company

Company representa uma empresa externa no contexto comercial. Possui identidade
própria por UUID e pode existir sem Contact ou Lead. Nome, domínio e CNPJ não
serão inferidos a partir de outro registro.

CNPJ será opcional. Sua canonicalização e identidade forte são decididas pela
ADR 009. Nome e domínio não implicam unicidade nem merge.

### Contact

Contact representa uma pessoa, independentemente de ela ter originado demanda
comercial. Seu UUID identifica a pessoa registrada; nome e meios de contato são
atributos mínimos e sujeitos à política de minimização da ADR 009.

`contacts.company_id` será opcional e representará somente o vínculo atual no
modelo inicial. Esse campo não representa histórico empregatício, múltiplos
vínculos, relação societária ou vínculo definitivo. Uma futura relação N:N ou
histórica poderá substituí-lo quando houver evidência real e plano de migração.

Alterar o vínculo atual do Contact nunca altera automaticamente Leads já
registrados. Um Contact pode existir sem Company, Lead ou Opportunity.

### Lead

Lead representa uma ocorrência de entrada ou demanda comercial a ser avaliada.
Ele exige `contact_id` e pode possuir `company_id` opcional, que representa a
Company no contexto daquela demanda.

Um Lead inbound pode ser criado antes que a Company seja conhecida. Quando uma
Company for identificada posteriormente, a associação será feita por comando
explícito, exigirá a mesma Organization e produzirá histórico auditável. Não
será criada Company fictícia e não haverá associação automática por domínio,
nome, e-mail, telefone ou similaridade.

`contacts.company_id` e `leads.company_id` são relações independentes: a
primeira descreve o vínculo atual simplificado da pessoa; a segunda preserva o
contexto do Lead. Nenhuma atualização é propagada silenciosamente entre elas.

O lifecycle inicial do Lead será:

- `open`: entrada registrada e ainda sem encerramento ou Opportunity;
- `converted`: uma Opportunity foi criada para o Lead;
- `closed`: entrada encerrada sem criar Opportunity.

As únicas transições serão `open → converted` e `open → closed`. Criar a
Opportunity e marcar o Lead como `converted` ocorrerão na mesma transação.
`converted` e `closed` serão terminais neste épico. Um Contact poderá ter
múltiplos Leads, mas cada Lead terá no máximo uma Opportunity.

### Opportunity e Commercial State

Opportunity representa uma possibilidade comercial explicitamente reconhecida
e pertence a exatamente um Lead. Ela será a única entidade proprietária do
Commercial State. Não haverá tabela ou máquina paralela de estado comercial no
Lead, Conversation, Assignment, fila ou worker.

A máquina inicial possui os estados:

- `open`;
- `discovery`;
- `qualified`;
- `proposal`;
- `negotiation`;
- `nurture`;
- `won`;
- `lost`;
- `disqualified`.

Opportunity nasce em `open`. As transições válidas são:

- `open → discovery | nurture | lost | disqualified`;
- `discovery → qualified | nurture | lost | disqualified`;
- `qualified → proposal | nurture | lost`;
- `proposal → negotiation | won | nurture | lost`;
- `negotiation → won | nurture | lost`;
- `nurture → discovery | lost | disqualified`.

`won`, `lost` e `disqualified` são terminais. Nenhuma transição inválida ou
regressão terminal pode ser persistida. Toda transição requer ator declarado,
motivo seguro e evento atômico conforme a ADR 009.

`qualified` registra somente uma decisão humana explícita neste épico. Ele não
autoriza score, regras de qualificação automática, IA ou inferência.

`contacted` será tratado como fato observável, não estado da Opportunity.
Diagnosis e Qualification em andamento são consolidados em `discovery`.
Scheduling, Meeting Scheduled, Meeting Completed, no-show e cancelamento ficam
adiados porque não existe Meeting neste épico.

### Conversation

Conversation representa uma sessão lógica ligada a um Lead e ao Contact desse
Lead. Ela possui channel descritivo, external thread ID opcional, status
`open/closed` e timestamps operacionais. Não implementa canal real.

No modelo inicial existe um único Contact principal. Participantes múltiplos,
conversa sem Lead e relação direta com múltiplas Opportunities ficam adiados.
Uma Conversation fechada não recebe novas Messages.

### Message

Message representa um registro imutável dentro de uma Conversation. O vertical
slice implementará somente mensagem `inbound`, autor `contact`, conteúdo
`text`. Outbound, human, agent, system e attachments ficam adiados.

Cada Message terá sequência monotônica por Conversation, tempo de ocorrência e
tempo de registro. Identidade externa, ordering e imutabilidade são decididos
pela ADR 009. Message não é comando de agente nem estado de orquestração.

### Assignment

Assignment registra a responsabilidade humana sobre o Lead e preserva o
histórico de atribuições. Haverá no máximo uma Assignment ativa por Lead. A
Opportunity usa o responsável do Lead e não mantém owner concorrente.

O assignee será uma referência humana declarada e não autenticada, permitida
somente no ambiente local. Essa referência não comprova identidade, autoridade
ou autorização. Agentes, usuários internos e integração com identity provider
ficam adiados.

### Limites de aplicação

As regras determinísticas ficarão em módulos de domínio e aplicação dentro de
`apps/api`, separadas de handlers HTTP e persistência. Contratos compartilhados
usarão `packages/schemas`; queries e migrations usarão `packages/database`.

Não serão criados Commercial Engine, Commercial OS, Commercial Brain,
orchestrator, event bus, nova fila ou novo package de domínio. Redis, BullMQ,
worker e n8n não participarão do vertical slice comercial.

## Consequências positivas

- Pessoa, demanda e oportunidade possuem significados distintos.
- Uma entrada pode ser preservada antes de Company ou Opportunity existirem.
- Nenhuma empresa artificial é necessária para satisfazer o schema.
- O estado comercial possui uma única fonte de verdade.
- Estados de atividade e de reunião não entram prematuramente no funil.
- O modelo mantém regras comerciais fora de transporte e infraestrutura.
- O domínio pode ser comprovado sem IA, fila ou integração externa.
- A simplificação Contact–Company e seus limites ficam explícitos.

## Consequências negativas

- O vínculo atual em `contacts.company_id` não representa relações históricas
  ou múltiplas.
- Um Lead com Company desconhecida exige associação posterior explícita.
- Limitar uma Opportunity por Lead pode não atender vendas futuras com múltiplas
  ofertas.
- O ator declarado não oferece não repúdio nem autorização.
- A máquina reduzida não representa reunião, no-show ou cancelamento.
- Regras no módulo da API precisarão ser extraídas se surgir outro consumidor.

## Riscos

- **Confundir Organization com tenant seguro:** mitigar com linguagem explícita,
  loopback e ausência de claims de isolamento.
- **Propagar Company incorretamente:** proibir inferência e atualização
  automática entre Contact e Lead.
- **Tratar vínculo atual como modelo definitivo:** documentar a simplificação e
  exigir plano para evolução N:N ou histórica.
- **Estado comercial inadequado ao processo real:** validar o vertical slice e
  usar ADR sucessora para mudança durável da máquina.
- **Ator forjado:** limitar a ambiente local e exigir autenticação/autorização
  antes de exposição.
- **Package prematuro surgir durante implementação:** exigir consumidor concreto
  e nova decisão antes de extração.
- **Meeting ser reintroduzida como estado sem entidade:** manter os estados de
  reunião explicitamente adiados.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-10. Sua aceitação,
em conjunto com a ADR 009, autoriza a implementação do Épico 02 estritamente
dentro do plano aprovado e dos limites de ambas as decisões.

Depois de aceitação humana explícita, a adoção deverá:

1. partir de `main` atualizada e seguir o CEF;
2. criar somente migrations aditivas, pequenas e reversíveis quando seguro;
3. ampliar apenas `apps/api`, `apps/cockpit`, `packages/database` e
   `packages/schemas` com consumidores concretos;
4. implementar o fluxo síncrono e as transações definidas nesta decisão;
5. aplicar a ADR 009 para eventos, comandos e identidades externas;
6. provar relações, lifecycle e transições com testes unitários, integração e
   E2E;
7. manter o Foundation CI e o vertical slice do Épico 01 verdes;
8. não alterar Ruleset, worker, BullMQ, Redis ou n8n.

## Reversão

Antes da aceitação, rejeitar ou revisar esta proposta não exige reversão de
produto, pois nenhuma implementação está autorizada.

Depois de aceita e antes de dados persistidos, implementação e migrations
podem ser revertidas no fluxo normal. Depois de existir dado, rollback da
aplicação deverá preservar as tabelas comerciais e restaurar a última versão
compatível. Dropar tabelas, apagar mensagens, eventos ou histórico exige
autorização destrutiva específica e backup quando aplicável.

Mudança durável em ownership de estado, cardinalidade Lead–Opportunity,
lifecycle, vínculo Contact–Company, identidade de ator ou extração de package
de domínio exige avaliação arquitetural e pode exigir ADR sucessora.

## Referências

- `docs/00-product-vision.md`
- `docs/03-commercial-process.md`
- `docs/06-state-machine.md`
- `docs/07-architecture.md`
- `docs/08-data-model.md`
- `docs/09-api-contracts.md`
- `docs/adr/005-foundation-technology-baseline.md`
- `docs/adr/006-durable-foundation-job-delivery.md`
- `docs/adr/009-commercial-audit-idempotency-and-external-identity.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/data-and-migrations.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
