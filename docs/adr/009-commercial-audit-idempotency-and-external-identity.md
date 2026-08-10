# ADR 009 — Adotar auditoria, idempotência e identidade externa comercial

- **Status:** Accepted
- **Data:** 2026-08-10
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

O Épico 02 introduzirá mutações comerciais síncronas para Company, Contact,
Lead, Assignment, Conversation, Message, Opportunity e Commercial State. O
domínio precisa preservar o que ocorreu, tolerar repetição e concorrência de
comandos e reconhecer identificadores externos futuros sem transformar audit
trail em fonte de verdade, event sourcing, event bus ou heurística de merge.

O PostgreSQL já é a fonte autoritativa da aplicação. Redis e BullMQ são
transporte da fundação conforme as ADRs 005 e 006, mas não participarão do
fluxo comercial deste épico. A RFC-0001 exige que o estado do domínio permaneça
separado do estado de orquestração e não autoriza abstração universal.

E-mail, telefone e mensagem podem conter dados pessoais. Persistir request ou
response completos apenas para idempotência aumentaria retenção e risco sem ser
necessário para reproduzir o resultado semântico de um comando.

## Problema

Como registrar fatos comerciais imutáveis, executar comandos idempotentes sob
concorrência, ordenar mensagens e tratar identidades externas de forma segura,
mantendo o estado atual nas entidades e minimizando dados pessoais?

## Restrições

- PostgreSQL é a fonte de verdade de entidades, estado e resultado de comando.
- `commercial_events` não pode substituir o estado atual das entidades.
- Não criar event sourcing, replay de eventos, event bus ou outbox genérico.
- Mutação e evento correspondente devem ser atômicos.
- Replay idempotente não pode reexecutar a mutação nem gerar novo evento.
- Mesma chave com payload semanticamente diferente deve retornar conflito.
- Concorrência deve ser resolvida por constraint PostgreSQL.
- O ledger de idempotência não armazenará payload ou response completos.
- External IDs não autorizam canal ou integração real.
- E-mail, telefone, nome e domínio não são identidades únicas automáticas.
- CNPJ pode ser identidade forte somente depois de validação e canonicalização.
- Message e Commercial Event serão imutáveis.
- Conteúdo de Message e dados pessoais não podem ser copiados para logs ou
  eventos sem necessidade explícita.
- Esta proposta não autoriza migrations ou implementação.

## Alternativas consideradas

### Manter somente o estado atual

Reduziria armazenamento, mas perderia ator, motivo e sequência dos fatos,
impedindo auditoria do vertical slice. Rejeitada porque o histórico é requisito
do domínio comercial.

### Reconstruir o estado por event sourcing

Produziria histórico completo por definição, mas tornaria eventos a fonte de
verdade, exigiria reducers, versionamento de replay, snapshots e recuperação
muito além do escopo. Rejeitada. Entidades atuais permanecem autoritativas.

### Publicar eventos em event bus ou outbox genérico

Prepararia consumidores futuros, porém ainda não existe consumidor assíncrono
comercial. Rejeitada por antecipar transporte, delivery e contratos sem uso.
`commercial_events` será somente audit trail persistido.

### Criar uma tabela histórica específica para cada entidade

Ofereceria FKs e schemas especializados, mas duplicaria mecanismo, consulta e
ordenação para cada fato do vertical slice. Rejeitada em favor de uma trilha
comercial concreta, limitada a tipos de evento aprovados e sem semântica de bus.

### Guardar request e response completos para replay

Permitiria resposta byte a byte, mas duplicaria mensagens e dados pessoais,
criaria retenção concorrente e acoplaria o ledger a representações mutáveis.
Rejeitada em favor de hash canônico e recibo mínimo persistido.

### Reexecutar a mutação durante replay

Poderia depender apenas das idempotências internas de cada entidade, mas
repetiria validações temporais, poderia produzir outro evento e tornaria o
resultado dependente do estado atual. Rejeitada. Replay será leitura do comando
concluído e de seu recibo.

### Manter idempotency key em cada tabela de domínio

Evitaria um ledger próprio, porém duplicaria request hash e semântica de replay,
além de não atender bem comandos que atualizam recursos existentes. Rejeitada
em favor de `commercial_commands`, estreito e específico da API comercial.

### Tornar e-mail ou telefone únicos

Facilitaria matching automático, mas endereços e números podem ser
compartilhados, reciclados, digitados incorretamente ou pertencer a caixas
genéricas. Rejeitada. Serão candidatos de correspondência, nunca merge
automático.

### Deduplicar Company por nome ou domínio

Reduziria duplicatas aparentes, mas grupos, marcas, filiais e domínios
compartilhados tornam a heurística ambígua. Rejeitada. Somente CNPJ validado
poderá atuar como identidade forte neste épico.

## Decisão

Adotar duas estruturas comerciais distintas: `commercial_events` para fatos
imutáveis e `commercial_commands` para idempotência HTTP. Nenhuma delas é
orquestrador, fila ou fonte de verdade alternativa para o estado atual.

### Estado atual e audit trail

O estado atual permanecerá nas entidades definidas pela ADR 008:

- vínculo atual em Contact;
- contexto e lifecycle em Lead;
- responsabilidade atual pela Assignment ativa;
- status em Conversation;
- conteúdo e sequência em Message;
- Commercial State em Opportunity.

`commercial_events` registrará fatos ocorridos e não será consultado para
reconstruir essas entidades. O vertical slice inicial poderá registrar somente:

- `company_created`;
- `contact_created`;
- `contact_linked`;
- `lead_created`;
- `lead_company_linked`;
- `owner_assigned`;
- `conversation_started`;
- `message_received`;
- `opportunity_created`;
- `state_changed`.

Adicionar tipo de evento exige comportamento e consumidor concretos. O evento
terá no mínimo ID, Organization, subject type e ID, Lead relacionado quando
aplicável, event type, event version, ator declarado, metadata mínima,
`occurred_at` e `recorded_at`.

Metadata poderá conter somente informação necessária para compreender o fato,
como estado anterior e posterior, IDs relacionados e código de motivo. Não
copiará texto de Message, nome, e-mail, telefone, CNPJ, request body ou response
body. Motivo textual sensível permanecerá na entidade apropriada quando for
necessário e não será logado indiscriminadamente.

### Atomicidade e imutabilidade

Cada mutação e seu Commercial Event serão escritos na mesma transação
PostgreSQL. Se o evento falhar, a mutação falha; se a mutação falhar, nenhum
evento de sucesso é persistido. Um replay de comando concluído não executa a
mutação e não adiciona evento.

Message e Commercial Event serão append-only. A aplicação não oferecerá
operações de update ou delete, e o banco bloqueará alteração e exclusão. Uma
correção futura exigirá novo fato compensatório, contrato e autorização, sem
reescrever o histórico.

### Commercial Commands

`commercial_commands` será o ledger estreito dos comandos HTTP comerciais. Um
registro persistido conterá no mínimo:

- `id`;
- `organization_id`;
- `command_type`;
- `idempotency_key`;
- `request_hash`;
- `status`;
- `target_type`;
- `target_id`, quando o comando possuir recurso alvo;
- `event_id`, quando o comando produzir evento;
- `result_code`;
- `result_http_status`;
- `result_schema_version`;
- `created_at`;
- `completed_at`.

O ledger não armazenará request, response, Message, nome, e-mail, telefone,
CNPJ ou motivo textual integral. `target_type`, `target_id`, `event_id`, código,
status HTTP e versão formam o recibo mínimo necessário para reproduzir o
resultado semântico.

Os estados do comando serão `in_progress` e `completed`. Reserva, mutação,
evento e conclusão ocorrerão em uma única transação. Em operação normal,
somente `completed` fica visível depois do commit; crash ou erro antes do commit
reverte também a reserva. Um registro `in_progress` persistido será tratado
como violação operacional e não autorizará reexecução silenciosa.

A constraint única será:

`(organization_id, command_type, idempotency_key)`.

`Idempotency-Key` não será global entre organizações ou tipos de comando.

### Request hash

O `request_hash` será SHA-256 de uma representação canônica do comando validado,
incluindo Organization, command type, parâmetros de rota, body semântico e ator
declarado. Campos puramente de transporte, correlation ID e a própria
Idempotency-Key não entram no hash. O payload canônico não será persistido no
ledger.

Canonicalização será determinística e versionada pelo contrato. Mudança que
altere o significado do hash exige nova versão de command type ou transição
compatível.

### Replay idempotente e concorrência

Para uma chave nova:

1. validar e canonicalizar o comando;
2. calcular `request_hash`;
3. reservar `commercial_commands` na transação;
4. executar a mutação uma vez;
5. registrar o Commercial Event na mesma transação;
6. persistir recibo e marcar o comando `completed`;
7. confirmar a transação;
8. responder a partir do recibo e do contrato aplicável.

Para a mesma chave e o mesmo hash, a API lê o comando `completed` e devolve
semanticamente o mesmo resultado: mesmo result code, status HTTP, target type,
target ID, event ID e versão. Ela não executa novamente a mutação, não altera o
recurso e não cria novo evento.

Resposta semântica não significa representação byte a byte de uma entidade
mutável. Se o endpoint também apresentar estado atual, ele será identificado
separadamente como leitura corrente; o recibo idempotente permanece o resultado
original do comando.

Para a mesma chave e hash diferente, a API retorna `409` sem mutação ou evento.

Requests concorrentes são serializados pela constraint PostgreSQL. O perdedor
aguarda a resolução da transação vencedora: se ela confirmar, aplica replay ou
conflito pelo hash; se ela reverter, o próximo request pode reservar e executar.
Não haverá check-then-insert fora da transação.

Falhas de validação antes da reserva e mutações revertidas não produzem comando
concluído nem evento de sucesso. Persistir resultados negativos determinísticos
fica adiado até existir necessidade comprovada.

### External IDs

External IDs são opcionais no fluxo local e não ativam integrações.

- Cada identidade externa terá um `external_namespace` técnico e estável que
  identifica a origem e, quando necessário, a conta externa, sem conter
  credencial. Channel sozinho não define namespace de unicidade.
- Lead: external source ID será único por Organization, namespace e source
  identificada.
- Conversation: external thread ID será único por Organization, namespace e
  channel.
- Message: external message ID será único por Organization, namespace e
  channel; a Conversation relacionada também será verificada.

Receber novamente o mesmo external ID com o mesmo conteúdo canônico retorna o
recurso já persistido. O mesmo external ID com conteúdo semanticamente
diferente retorna `409`; nenhuma heurística decide qual payload é correto.

Quando um external ID estiver presente, a entidade persistirá também um hash
semântico versionado dos campos normalizados relevantes para aquela identidade.
Esse hash permite distinguir redelivery de colisão sem armazenar payload externo
integral. Mudança na canonicalização exige nova versão compatível; não se deve
reinterpretar silenciosamente hashes já persistidos.

IDs externos não serão reutilizados como UUID interno e não serão considerados
confiáveis para autorização.

### Company e Contact

CNPJ será opcional, reduzido a 14 dígitos e validado pelos dígitos verificadores
antes de persistir. Um CNPJ canonicalizado será único dentro da Organization.
Conflito aponta para a Company já existente ou retorna `409`; nunca realiza
merge implícito.

Nome e domínio de Company poderão ser normalizados para busca, mas não terão
unicidade semântica. E-mail será canonicalizado de forma conservadora e telefone
será normalizado quando válido, mas ambos permanecerão não únicos e serão
apenas candidatos para resolução humana futura.

Não haverá deduplicação automática por nome, domínio, e-mail, telefone,
similaridade, combinação de campos ou inferência de Company para Lead.

### Ordering de Message

Cada Conversation terá sequência monotônica atribuída pelo PostgreSQL. Inserção
concorrente reservará a próxima sequência sob lock e terá unicidade por
Conversation. Ordenação autoritativa de ingestão será `(conversation_id,
sequence)`.

`occurred_at` preserva o tempo declarado pela origem, mas não altera a ordem de
ingestão e pode chegar atrasado. `recorded_at` é atribuído pelo banco. External
message ID e Idempotency-Key impedem que redelivery crie nova sequência.

### Minimização e observabilidade

Message text será limitado e armazenado somente na entidade Message. Logs e
Commercial Events usarão IDs técnicos, tipos, estados, códigos e timestamps,
sem conteúdo integral ou dados pessoais. Fixtures serão sintéticas.

Nenhuma decisão desta ADR autoriza retenção indefinida, canal real, autenticação,
deploy externo ou uso de dados para IA. Políticas de retenção e eliminação
exigirão decisão própria antes de produção.

## Consequências positivas

- Estado atual e histórico possuem responsabilidades distintas.
- Toda mutação bem-sucedida possui fato atômico e auditável.
- Replay não duplica mutação, Message, Assignment, transição ou evento.
- Concorrência é resolvida na fonte de verdade.
- O recibo idempotente evita duplicar payload e dados pessoais.
- External IDs possuem escopos claros sem se tornarem identidade interna.
- CNPJ forte não transforma sinais ambíguos em merge automático.
- Ordering de Message permanece determinístico sob concorrência e atraso.

## Consequências negativas

- Toda mutação comercial passa a escrever comando e evento além da entidade.
- A trilha exige versionamento cuidadoso dos event types e metadata.
- O recibo reproduz semântica, não necessariamente bytes de resposta histórica.
- `commercial_commands` adiciona coordenação transacional à API síncrona.
- E-mail e telefone duplicados exigirão resolução humana futura.
- Imutabilidade exige fato compensatório em vez de correção destrutiva.
- Um `in_progress` persistido exige diagnóstico antes de qualquer recuperação.

## Riscos

- **Evento virar fonte de verdade:** mitigar mantendo queries e invariantes nas
  entidades atuais e proibindo replay.
- **Evento virar bus por expansão:** exigir consumidor e nova decisão antes de
  delivery assíncrono.
- **Payload sensível vazar em metadata:** usar allowlist por event type, testes
  de redaction e nenhuma metadata arbitrária originada do request.
- **Replay retornar estado mutável como resultado original:** separar recibo
  imutável de leitura corrente no contrato.
- **Canonicalização mudar silenciosamente:** versionar command type e testar
  hashes de contrato.
- **Deadlock ou contenção:** manter transações curtas, índices únicos adequados
  e testes concorrentes.
- **CNPJ válido mas pertencente a Company incorreta:** conflito impede merge e
  exige resolução explícita.
- **External ID colidir entre origens:** incluir Organization, namespace e
  source/channel no escopo de unicidade.
- **Timestamp externo ordenar incorretamente:** usar sequence do banco como
  ordem autoritativa de ingestão.
- **Histórico imutável impedir correção legítima:** usar evento compensatório
  futuro, sem reescrever fatos anteriores.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-10. Sua aceitação,
em conjunto com a ADR 008, autoriza a implementação do Épico 02 estritamente
dentro do plano aprovado e dos limites de ambas as decisões.

Depois de aceitação humana explícita e aceitação da ADR 008, a adoção deverá:

1. criar migrations pequenas para commands, events, constraints e índices;
2. implementar reserva e conclusão de comando na mesma transação da mutação;
3. implementar event writers por tipos explícitos, sem dispatcher;
4. bloquear update/delete de Message e Commercial Event;
5. implementar canonicalização e hash sem persistir payload integral;
6. testar replay, conflito e concorrência para cada comando do vertical slice;
7. testar external IDs duplicados e mensagens fora de ordem;
8. testar que falha de evento reverte a mutação;
9. testar que logs, events e commands não contêm dados pessoais proibidos;
10. incorporar os testes ao Foundation CI sem alterar o Ruleset.

## Reversão

Antes da aceitação, rejeitar ou revisar esta proposta não exige reversão de
produto, pois nenhuma implementação está autorizada.

Depois de aceita, rollback de aplicação deverá preservar entities,
`commercial_commands`, `commercial_events` e Messages. Remover o writer de
eventos sem interromper mutações não é rollback seguro. Antes de desativá-lo,
novos comandos comerciais devem ser interrompidos ou a última versão compatível
deve ser restaurada.

Dropar ledger, audit trail ou mensagens exige autorização destrutiva, backup e
análise de retenção. Alterar fonte de verdade, semântica de replay, escopo de
identidade, imutabilidade, delivery de eventos ou adicionar event sourcing/bus
exige ADR sucessora.

## Referências

- `docs/08-data-model.md`
- `docs/09-api-contracts.md`
- `docs/adr/005-foundation-technology-baseline.md`
- `docs/adr/006-durable-foundation-job-delivery.md`
- `docs/adr/008-commercial-domain-model-and-lifecycle.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/api-contracts.md`
- `docs/engineering/standards/data-and-migrations.md`
- `docs/engineering/standards/observability.md`
- `docs/engineering/standards/security.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
