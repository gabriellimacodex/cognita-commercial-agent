# RFC-0001 — Universal Orchestration Model

- **Status:** Final
- **Data:** 2026-08-10
- **Disposição:** direção arquitetural conceitual aceita
- **Efeito normativo:** não autorizador
- **Implementação associada:** nenhuma

## 1. Resumo executivo

Existe um protocolo conceitual recorrente para coordenar trabalho em engenharia, comercial, Customer Success, financeiro, RH e operações. Esse protocolo não demonstra a necessidade de um runtime, serviço, package, banco, schema ou domínio tecnológico compartilhado.

A direção aceita é: **protocolo comum, domínio independente**.

O modelo pode orientar comparação entre domínios, desde que preserve orquestração federada, regras e fontes de verdade específicas, além das separações entre `Domain State` e `Orchestration State`, `Result` e `Outcome`, `Authority` e `Executor`, `Capability` e `Tool`.

## 2. Problema

O CEF revelou uma responsabilidade implícita por classificar intenções, selecionar workflows e Skills, controlar estados, validar gates, interromper execuções e coordenar o ciclo de trabalho. O processo comercial apresenta forma estrutural semelhante ao recuperar contexto, interpretar intenção, avaliar estado, aplicar regras, escolher ação, verificar permissão e registrar resultado.

A questão é se essa recorrência representa um modelo útil ou apenas uma analogia superficial entre domínios distintos.

## 3. Hipótese

Qualquer fluxo operacional relevante pode ser descrito como um caso de trabalho governado por objetivo, contexto, estado, autoridade, políticas, transições, executores, ações, evidências e resultado.

A hipótese não afirma que todos os domínios devam compartilhar implementação, armazenamento, processo ou ontologia.

## 4. Argumentos favoráveis

- Fluxos distintos respondem às mesmas perguntas sobre objetivo, estado, autoridade, transição, execução e evidência.
- Autoridade e execução podem permanecer separadas.
- Humanos, agentes e serviços podem fornecer capacidades sob os mesmos limites de autorização.
- Controles de idempotência, timeout, retry, evidência, auditoria, pausa e escalonamento são recorrentes.
- Handoffs entre áreas podem usar contratos explícitos sem compartilhar estado interno.

## 5. Argumentos contrários

- Termos universais podem esconder semântica de domínio relevante.
- Trabalho exploratório ou negociado nem sempre cabe em workflow previsível.
- Um estado único produziria explosão combinatória entre domínio e execução.
- GitHub, PostgreSQL, ledger financeiro e sistemas de RH possuem autoridades incompatíveis.
- Domínios operam com escalas, latências, riscos e requisitos regulatórios diferentes.
- Uma plataforma prematura criaria abstrações sem consumidores comprovados.
- Um orquestrador monolítico criaria falha correlacionada para toda a organização.

## 6. Modelo conceitual

O modelo possui quatro camadas:

1. **Autoridade:** define objetivo, permissão, decisão, exceção e interrupção.
2. **Domínio:** define subject, invariantes, estados, transições, políticas e fonte de verdade.
3. **Orquestração:** coordena ciclo de execução, gates, tarefas, espera, retry, escalonamento e evidência.
4. **Execução:** reúne humanos, funcionários digitais, serviços, capacidades e ferramentas.

O protocolo comum pertence à coordenação. Regras e dados permanecem nos domínios.

## 7. Entidades conceituais

- **Intent:** solicitação ou evento que inicia avaliação.
- **Objective:** condição de sucesso pretendida.
- **Subject:** objeto de domínio sobre o qual o trabalho ocorre.
- **Context:** informações disponíveis para uma decisão, com origem conhecida.
- **Process Definition:** grafo versionado de estados, transições, gates e ações possíveis.
- **Case:** instância durável de trabalho orientada a um objetivo.
- **Run:** tentativa de executar parte ou todo o Case.
- **Plan:** estratégia opcional específica de um Case.
- **Domain State:** estado autoritativo do objeto no domínio.
- **Orchestration State:** estado da coordenação do trabalho.
- **Transition:** mudança autorizada entre estados.
- **Gate:** condição necessária para avançar.
- **Policy:** regra determinística que permite, bloqueia ou condiciona ação.
- **Authority:** direito de aprovar, rejeitar, interromper, delegar ou excepcionar.
- **Actor:** humano, agente ou sistema participante.
- **Capability:** competência necessária para realizar tarefa.
- **Task:** unidade de trabalho atribuível.
- **Action:** efeito pretendido no domínio ou em sistema externo.
- **Tool:** mecanismo de execução; não decide autorização.
- **Decision:** escolha registrada com autoridade, justificativa e evidência.
- **Evidence:** artefato que sustenta decisão, gate ou resultado.
- **Event:** registro imutável de algo ocorrido.
- **Result:** saída imediata de uma ação.
- **Outcome:** efeito relevante associado ao objetivo.
- **Exception:** condição que exige retry, compensação, intervenção ou encerramento alternativo.
- **Temporal Constraint:** prazo, SLA, timeout, espera ou condição temporal.

`Skill` é uma forma de oferecer `Capability` a um funcionário digital; não é entidade obrigatória em todo domínio.

## 8. Máquina de estados

O modelo separa duas máquinas.

### Orchestration State

- `CREATED`
- `CONTEXTUALIZED`
- `READY`
- `EXECUTING`
- `WAITING`
- `VERIFYING`
- `COMPLETED`

Estados excepcionais:

- `PAUSED`
- `BLOCKED`
- `ESCALATED`
- `RETRY_PENDING`
- `FAILED`
- `REJECTED`
- `CANCELLED`

### Domain State

Permanece específico. Uma oportunidade pode estar em `Negociação` enquanto a orquestração está `WAITING`. Uma Pull Request pode estar aberta enquanto a execução está `BLOCKED`.

O orquestrador solicita transições. A fonte de verdade do domínio valida e persiste seu estado.

## 9. Fluxo conceitual

1. receber intenção ou evento;
2. identificar objetivo e subject;
3. verificar autoridade;
4. recuperar contexto autorizado;
5. consultar estado de domínio;
6. selecionar processo aplicável;
7. criar ou retomar Case e Run;
8. calcular transições elegíveis;
9. avaliar gates e políticas;
10. identificar capacidades e atores;
11. emitir tarefas e ações autorizadas;
12. executar por ferramenta apropriada;
13. registrar resultado, evento e evidência;
14. reconciliar com a fonte de verdade do domínio;
15. avançar, aguardar, tentar novamente, pausar ou escalar;
16. encerrar somente quando o Outcome estiver comprovado.

Um domínio pode criar um Case filho em outro por handoff explícito, sem assumir controle sobre seus estados internos.

## 10. Limites

O protocolo conceitual pode descrever Case, Run, coordenação, gates, autoridade, evidência, tempo, retry e handoff.

Ele não deve possuir score comercial, política de desconto, estado contábil, critérios de contratação, regras do CEF, dados principais do lead, ledger financeiro, estado autoritativo do GitHub ou semântica específica de Outcome.

IA pode classificar, sugerir, resumir e propor. IA não concede autoridade, ignora política determinística ou altera fonte de verdade crítica por conta própria.

## 11. Casos onde não utilizar

Não aplicar quando:

- uma operação local simples e determinística resolve o problema;
- não existe processo durável ou necessidade de auditoria;
- o overhead de Case e evidência supera o risco;
- sistema especializado já coordena o processo adequadamente;
- requisitos de tempo real são incompatíveis;
- não existe autoridade sobre o processo externo;
- trabalho exploratório ainda não possui objetivo minimamente estável;
- a abstração eliminaria semântica regulatória, financeira ou humana relevante.

O modelo não deve transformar toda conversa ou ação humana em workflow formal.

## 12. Impacto no CEF

O conceito de CEF Orchestrator permanece uma especialização de engenharia. Constituição, ADRs, workflows, Skills, Git e GitHub continuam específicos do domínio de engenharia.

Esta RFC não altera o CEF nem autoriza um componente compartilhado.

## 13. Impacto no Commercial OS

Um futuro Commercial Orchestrator poderá ser uma especialização comercial. O Commercial Engine continuará responsável por estados, regras, score, permissões e próxima melhor ação; a fonte de verdade comercial continuará específica do domínio.

Esta RFC não autoriza Commercial Orchestrator, Commercial OS, Commercial Brain ou funcionalidade comercial.

## 14. Impacto na plataforma Cognita

O conceito pode futuramente permitir linguagem comum para coordenação de trabalho, mantendo políticas, dados e runtimes federados. Ainda não existe evidência empírica suficiente para transformar o conceito em núcleo tecnológico.

## 15. Decisão e pré-condições futuras

Não será criado agora:

- Universal Orchestrator;
- runtime, serviço ou package universal;
- banco ou schema universal;
- abstração compartilhada de domínio;
- infraestrutura de orquestração comum;
- Commercial Orchestrator ou Commercial OS.

Qualquer reconsideração tecnológica exige cumulativamente:

1. pelo menos dois domínios reais implementados;
2. comparação empírica entre eles;
3. nova análise arquitetural;
4. ADR específica;
5. plano aprovado;
6. autorização humana explícita.

A conclusão preservada é: **protocolo comum, domínio independente**.
