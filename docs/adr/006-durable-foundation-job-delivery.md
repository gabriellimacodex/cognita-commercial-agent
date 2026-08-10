# ADR 006 — Adotar entrega durável para jobs da fundação

- **Status:** Accepted
- **Data:** 2026-08-10
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

O vertical slice do Épico 01 precisa receber um comando técnico pela API,
persisti-lo, publicá-lo no BullMQ, processá-lo no worker, persistir o resultado
e permitir consulta posterior pela API e pelo cockpit. Esse fluxo atravessa
PostgreSQL e Redis, que não compartilham transação atômica.

Redis e BullMQ podem sofrer indisponibilidade, redelivery, perda de dados ou
interrupção do worker. Persistir apenas na fila faria o estado depender de um
transporte; persistir no PostgreSQL e publicar sem recovery deixaria uma janela
de perda entre os dois sistemas.

A decisão deve resolver somente o job técnico da fundação. Ela não pode usar o
Épico 01 para criar abstração universal, infraestrutura comercial ou framework
reutilizável sem consumidores comprovados.

## Problema

Como garantir persistência antes da publicação, idempotência, processamento
at-least-once, recuperação e estados não regressivos para o job técnico, usando
PostgreSQL como fonte de verdade e BullMQ como transporte, sem transação
distribuída ou infraestrutura genérica?

## Restrições

- PostgreSQL deve ser a única fonte de verdade do job e de seu resultado.
- Redis e BullMQ são transporte e coordenação, não armazenamento autoritativo.
- O registro inicial deve ser commitado antes da publicação.
- A solução deve tolerar Redis indisponível, worker indisponível, redelivery e
  interrupção entre persistência e publicação.
- `Idempotency-Key` deve impedir criação duplicada sob concorrência.
- O worker deve processar uma única operação técnica determinística.
- Estados terminais não podem regredir.
- A solução deve usar somente a fila técnica de fundação.
- Não criar tabela `events`, event bus, event sourcing ou outbox genérico.
- Não introduzir conceito comercial, organização como tenant ou lógica de IA.
- Não implementar endpoint público de reprocessamento manual neste épico.
- Esta ADR depende da baseline aceita na ADR 005.

## Alternativas consideradas

### Persistir somente no BullMQ

Simplificaria a API, mas tornaria Redis fonte de verdade e perderia estado em
reset, corrupção ou política de retenção. Rejeitada por contrariar a fonte de
verdade definida para a fundação.

### Persistir no PostgreSQL e publicar uma única vez

Preserva o comando, mas uma falha ou crash depois do commit deixaria o job sem
execução. Rejeitada porque não oferece recuperação da janela entre os sistemas.

### Publicar antes de persistir

Evitaria job persistido sem fila, porém permitiria processamento sem registro
autoritativo e impossibilitaria consulta confiável. Rejeitada porque inverte a
ordem obrigatória do fluxo.

### Usar transação distribuída entre PostgreSQL e Redis

PostgreSQL e BullMQ não oferecem um protocolo transacional comum adequado a
esse fluxo. Introduzir coordenação distribuída aumentaria complexidade sem
eliminar redelivery. Rejeitada.

### Criar tabela genérica de outbox ou eventos

Poderia atender futuros produtores, mas ainda existe somente um comando e uma
fila técnica. Rejeitada porque anteciparia schema, dispatcher e semântica para
consumidores inexistentes.

### Usar `foundation_jobs` como outbox estreito e estado autoritativo

Mantém comando, estado, tentativas e resultado no mesmo registro que possui uso
concreto. Permite recovery por consulta ao PostgreSQL e publicação idempotente
com o mesmo identificador. Selecionada como menor solução que fecha as janelas
de falha do épico.

### Adicionar estados `publish_failed`, `retrying` ou `interrupted`

Tornaria condições operacionais visíveis no nome do estado, mas aumentaria
transições e permitiria que detalhes temporários do transporte competissem com
o ciclo principal do job. Rejeitada porque tentativas, erros, agendamento e
lease distinguem essas condições sem novo estado.

### Processar sincronamente na API

Eliminaria a fila, mas não provaria a arquitetura assíncrona, worker, retries ou
recovery exigidos pelo vertical slice. Rejeitada.

## Decisão

Usar `foundation_jobs` simultaneamente como recurso autoritativo do job técnico
e outbox estreito de sua publicação. Essa escolha é local ao Épico 01 e não
cria componente reutilizável.

### Fonte de verdade e limites transacionais

O `POST /foundation/jobs` deverá:

1. validar o body e `Idempotency-Key`;
2. iniciar transação PostgreSQL;
3. criar o job em `pending`, ou recuperar replay idempotente;
4. confirmar a transação;
5. tentar publicar no BullMQ usando o UUID persistido como `jobId`;
6. confirmar `queued` com compare-and-set quando a publicação for aceita;
7. manter o job recuperável no PostgreSQL quando a publicação falhar.

Falha do Redis depois do commit não apaga o recurso nem muda o PostgreSQL para
um estado fictício de sucesso. A API pode responder `202` com estado `pending`,
pois o comando já está durável e será reconciliado.

O payload da fila conterá somente o UUID do job e contexto técnico de
correlação. O worker carregará input e estado autoritativos do PostgreSQL.

### Idempotência

- `Idempotency-Key` será obrigatória e terá constraint única no PostgreSQL.
- O body validado será canonicalizado e terá `request_hash` SHA-256 persistido.
- Mesma chave e mesmo hash retornam o job existente sem criar ou republicar
  desnecessariamente.
- Mesma chave e hash diferente retornam conflito `409`.
- Corridas de criação serão resolvidas pela constraint única, não por
  check-then-insert fora da transação.
- BullMQ receberá o UUID persistido como `jobId`; re-publicação usará o mesmo
  valor.

Idempotência de criação não significa exactly-once. A execução é at-least-once
e precisa tolerar redelivery.

### Estados mínimos

Adotar exatamente cinco estados:

| Estado | Invariante |
|---|---|
| `pending` | Registro commitado; publicação ainda não confirmada |
| `queued` | Publicação aceita pelo BullMQ |
| `processing` | Processamento iniciado; tentativa ativa ou próximo retry autorizado |
| `completed` | Resultado persistido; estado terminal |
| `failed` | Tentativas esgotadas e erro seguro persistido; estado terminal |

Os cinco estados são suficientes:

1. persistência concluída é representada por `pending`;
2. publicação confirmada é representada por `queued`;
3. processamento é representado por `processing`;
4. retry é distinguido por `process_attempts`, erro da tentativa e
   auto-transição controlada em `processing`;
5. falha terminal é representada por `failed`.

Falha de publicação permanece `pending` com `publish_attempts`,
`last_error_code` e `next_publish_at`. Interrupção de processamento permanece
`processing` com lease expirada. Não adicionar estado apenas para refletir
condição transitória do transporte.

### Transições

As transições permitidas são:

- `pending → queued`;
- `pending → processing`, somente quando o worker consumir antes da confirmação
  de `queued` pela API;
- `queued → processing`;
- `processing → processing`, somente quando o próximo retry registrado estiver
  vencido e não houver lease ativa, ou para recuperar lease expirada;
- `processing → completed`;
- `processing → failed`.

`completed` e `failed` são terminais. Reentrega de job terminal retorna no-op e
o resultado persistido. Nenhuma transição para `pending` ou `queued` é permitida
depois que o processamento começou.

Updates de estado usarão compare-and-set no PostgreSQL, incluindo estado de
origem permitido. Timestamps, contadores e constraints reforçarão invariantes
que pertencem ao banco.

### Publicação e recovery

Um reconciliador estreito executado pelo worker consultará somente
`foundation_jobs` recuperáveis, em lotes limitados e com concorrência protegida
por locking PostgreSQL.

Ele tratará:

- `pending` cujo `next_publish_at` venceu;
- `queued` antigo que ainda não iniciou processamento, cobrindo perda da fila;
- `processing` cuja lease expirou, cobrindo interrupção do worker.

Cada tentativa de publicação usa o mesmo BullMQ `jobId`. Encontrar o job já
presente na fila é sucesso idempotente. Falha transitória registra tentativa,
erro seguro e próximo horário com backoff. O recovery não altera estado
terminal.

Para `processing` interrompido, o reconciliador republica sem regredir o estado.
Nessa recuperação, o processor aceita a auto-transição somente se a lease
estiver expirada. A operação técnica é curta e limitada; a lease usa tempo do
PostgreSQL para evitar depender do relógio local dos processos.

### Retries, redelivery e falha terminal

- BullMQ fará número limitado de tentativas com backoff.
- Cada início válido adquirirá lease por compare-and-set e incrementará
  `process_attempts` no PostgreSQL.
- Falha transitória tratada preservará `processing`, registrará
  `next_process_at` compatível com o backoff e liberará a lease antes de
  devolver a falha ao BullMQ.
- Crash inesperado deixará a lease vencer; redelivery antes do vencimento não
  executará a operação em paralelo.
- A tentativa final persistirá `failed`, código e mensagem seguros.
- Redelivery concorrente não pode sobrescrever estado terminal.
- Resultado só será considerado concluído depois de persistido no PostgreSQL.
- Retenção ou remoção de jobs no BullMQ não altera o estado autoritativo.

Reprocessamento manual de um job `failed` não faz parte do Épico 01. Uma futura
capacidade desse tipo exigirá contrato, autorização, semântica de tentativa e
plano próprios.

### Operação técnica determinística

O worker calculará SHA-256 do input técnico persistido e gravará resultado com
algoritmo, digest e tamanho do input. Não haverá lead, oportunidade,
qualificação, score, mensagem, prompt, memória ou outra semântica comercial.

A operação não produz efeito externo. Execuções duplicadas calculam o mesmo
resultado; apenas compare-and-set autorizado pode persistir a transição
terminal.

### Perda de Redis e worker indisponível

- Redis indisponível durante o POST deixa o job `pending` e consultável.
- Redis restaurado permite nova publicação pelo reconciliador.
- Perda da fila com job `queued` é detectada por antiguidade e republicada.
- Worker indisponível deixa o job `queued`; recuperação ocorre quando o worker
  retorna.
- Worker interrompido deixa `processing`; lease expirada permite redelivery.
- PostgreSQL indisponível impede criação ou transição, pois nenhum outro sistema
  pode assumir autoridade.

Redis AOF pode ser habilitado no desenvolvimento, mas não participa da garantia
de durabilidade desta decisão.

### Limites explícitos

Esta decisão não cria:

- framework genérico de jobs;
- outbox framework reutilizável;
- tabela ou barramento genérico de eventos;
- event sourcing;
- Universal Orchestrator;
- runtime universal;
- infraestrutura comercial;
- garantia exactly-once;
- reprocessamento manual público;
- coordenação de múltiplas filas;
- multi-tenancy.

A direção da RFC-0001 permanece `protocolo comum, domínio independente`. O job
da fundação é uma implementação técnica local e não é evidência para abstração
universal.

## Consequências positivas

- O comando existe no PostgreSQL antes de qualquer tentativa de publicação.
- Falha do Redis ou do worker não elimina o estado autoritativo.
- Uma única tabela concreta fecha a janela de dual write sem event bus
  prematuro.
- Chaves e constraints resolvem concorrência de criação no banco.
- `jobId` determinístico e compare-and-set tornam redelivery seguro para a
  operação técnica.
- Os estados permanecem mínimos e semanticamente distinguíveis.
- O cockpit pode recarregar e consultar resultado sem depender do BullMQ.

## Consequências negativas

- A entrega é at-least-once e pode executar o cálculo mais de uma vez.
- `foundation_jobs` acumula campos de publicação, execução e recovery.
- O worker assume uma pequena responsabilidade periódica além do processor.
- Recovery por antiguidade e lease exige thresholds e índices operacionais.
- Um job pode permanecer `pending`, `queued` ou `processing` durante uma
  indisponibilidade prolongada.
- A solução é específica; outro produtor futuro não pode reutilizá-la por
  pressuposição.

## Riscos

- **Job preso por falha não classificada:** mitigar com queries de recovery,
  health, logs e testes de Redis/worker indisponíveis.
- **Duplicidade concorrente:** mitigar com `jobId` determinístico,
  compare-and-set e operação sem efeito externo.
- **Lease curta causar redelivery durante execução:** mitigar com operação
  limitada, threshold superior ao timeout e tempo do PostgreSQL.
- **Lease longa atrasar recuperação:** mitigar com valor configurado, teste de
  interrupção e observabilidade de duração.
- **Scanner gerar carga no PostgreSQL:** mitigar com índice parcial, lote,
  intervalo e locking limitado.
- **Erro sensível persistido ou logado:** mitigar com códigos estáveis, mensagem
  segura e redaction.
- **Estado `failed` ser reprocessado informalmente:** mitigar tratando-o como
  terminal e omitindo endpoint de retry manual.
- **Solução estreita virar framework por expansão incremental:** mitigar com
  ADR sucessora diante de novo produtor, fila ou semântica.
- **Redis ser tratado como backup:** mitigar com testes de perda e documentação
  de PostgreSQL como única fonte de verdade.

## Adoção

Esta ADR foi aceita por decisão humana explícita em 2026-08-10. A ADR 005
também está aceita e precede a implementação da baseline da qual esta decisão
depende.

Depois da aceitação:

1. criar migrations pequenas para `foundation_jobs` e seu índice de recovery;
2. testar `up`, `down` e nova aplicação em banco descartável;
3. implementar criação idempotente e consulta;
4. implementar publicação após commit;
5. implementar um processor e um reconciliador estreito;
6. provar falha de Redis, worker indisponível, redelivery, perda da fila e
   shutdown;
7. provar o vertical slice completo e reload do cockpit;
8. registrar logs estruturados sem input ou segredo.

Nenhuma implementação comercial ou abstração universal faz parte da adoção.

## Reversão

Antes da aceitação, a ADR podia ser revisada ou rejeitada sem efeito de runtime.

Depois de aceita e antes de dados persistidos, implementação e migrations podem
ser revertidas por Pull Request em ambiente descartável. Depois de existir
dado, rollback de aplicação deve primeiro interromper novos produtores e
consumidores, preservar `foundation_jobs`, restaurar a última versão compatível
e reconciliar jobs não terminais. Dropar tabela ou volume exige autorização
destrutiva específica e backup quando aplicável.

Mudança durável de fonte de verdade, estados, idempotência, fila, semântica de
reprocessamento ou generalização do outbox exige ADR sucessora. Desabilitar o
reconciliador sem tratar jobs recuperáveis não é rollback seguro.

## Referências

- `docs/07-architecture.md`
- `docs/08-data-model.md`
- `docs/15-epic-01-foundation.md`
- `docs/adr/005-foundation-technology-baseline.md`
- `docs/engineering/constitution.md`
- `docs/engineering/standards/architecture.md`
- `docs/engineering/standards/data-and-migrations.md`
- `docs/engineering/standards/observability.md`
- `docs/engineering/standards/testing.md`
- `docs/rfcs/0001-universal-orchestration-model.md`
