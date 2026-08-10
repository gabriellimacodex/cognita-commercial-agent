# ADR 003 — Operar a governança com um único mantenedor

- **Status:** Accepted
- **Data:** 2026-08-10
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

O Cognita Engineering Framework foi criado enquanto a Cognita possui um único mantenedor humano e ainda não dispõe de CI configurado. O workflow inicial de Pull Request exigia aprovação humana independente e CI verde para toda mudança, além de duas aprovações humanas para alterações constitucionais e riscos críticos.

Esses gates pressupõem capacidade humana e automação que ainda não existem. Mantê-los tornaria a própria adoção do CEF impossível; removê-los sem condições reduziria permanentemente a governança futura.

## Problema

Como operar o CEF de forma auditável e verificável enquanto existe somente um mantenedor humano, sem representar self-review ou revisão de agente como aprovação humana e sem enfraquecer os controles do futuro modo de equipe?

## Restrições

- Pull Requests continuam obrigatórias.
- Nenhuma identidade, equipe ou aprovação fictícia pode ser criada.
- Self-review não equivale a revisão humana independente.
- Revisão de agente não equivale a aprovação humana.
- Merge pelo autor não equivale a autoaprovação.
- Todo check configurado continua obrigatório.
- Evidência local pode substituir somente checks que ainda não existem.
- O modo temporário precisa ter critérios objetivos de encerramento.

## Alternativas consideradas

### Manter os gates originais

Rejeitada porque impediria qualquer merge enquanto não existirem dois revisores independentes e CI, inclusive o merge que corrige essa inconsistência.

### Remover aprovações e CI permanentemente

Rejeitada porque transformaria uma limitação temporária em redução estrutural da governança.

### Considerar revisão de agente como aprovação humana

Rejeitada porque falsearia segregação de funções. Agentes podem produzir evidência e findings, mas não substituem autoridade ou aprovação humana.

### Adotar modos operacionais explícitos

Selecionada porque torna os gates proporcionais à capacidade real, preserva transparência e define uma transição verificável para governança de equipe.

## Decisão

Adotar dois modos operacionais no CEF:

- `Single Maintainer`: modo inicial e temporário, ativo enquanto a Cognita não consegue satisfazer os gates humanos e automatizados do modo de equipe.
- `Engineering Team`: modo futuro, ativado somente após os critérios de transição desta ADR e da Constituição serem demonstrados.

No modo `Single Maintainer`:

- o mantenedor pode integrar a própria Pull Request sem registrar isso como aprovação independente;
- self-review integral e uma segunda passagem explícita são obrigatórios;
- revisão assistida por agente é evidência adicional e deve declarar sua limitação;
- findings P0, P1 ou `blocking` impedem avanço;
- checks configurados precisam passar;
- na ausência de um check, a Pull Request deve registrar comando, resultado e limitação da validação local correspondente;
- decisões arquiteturais, emendas constitucionais, segurança, ações destrutivas e risco crítico exigem decisão humana explícita, riscos e rollback documentados;
- quando existir outro reviewer humano elegível, utilizar a revisão independente disponível, mesmo antes da transição completa de modo.

A matriz operacional de gates pertence ao workflow de Pull Request. Esta ADR define a decisão e seus limites, sem duplicar o procedimento.

## Consequências positivas

- O CEF pode operar imediatamente sem inventar aprovações.
- Limitações humanas e de automação ficam explícitas e auditáveis.
- Checks existentes não podem ser ignorados.
- A disciplina de self-review, evidência, ADR e rollback é preservada.
- A transição para governança de equipe possui condições verificáveis.

## Consequências negativas

- Autoria, revisão e merge permanecem concentrados em uma pessoa.
- A segunda passagem não oferece independência humana real.
- Validações locais possuem menor garantia que CI obrigatório.
- O mantenedor único continua sendo ponto de falha operacional e de acesso.

## Riscos

- **Normalização do modo temporário:** mitigar com critérios objetivos de saída e revisão periódica do modo ativo.
- **Confusão entre revisão assistida e aprovação:** mitigar exigindo que tipo de revisão e limitações sejam declarados na Pull Request.
- **Evidência local incompleta:** mitigar registrando comandos, resultados e checks não executados.
- **Bypass de check existente:** proibir substituição manual de qualquer check já configurado.
- **Transição prematura:** exigir demonstração dos controles e ADR sucessora.

## Adoção

O modo `Single Maintainer` torna-se ativo com a adoção desta ADR e da Constituição 1.1.0.

A transição para `Engineering Team` exige cumulativamente:

1. CI obrigatório configurado e estável;
2. branch protection ou ruleset compatível com o workflow oficial;
3. `CODEOWNERS` com identidades reais e responsabilidades aceitas;
4. capacidade para duas revisões humanas independentes em mudanças críticas, equivalente a autor e pelo menos dois reviewers elegíveis;
5. Pull Request de validação demonstrando os gates;
6. concordância explícita dos novos mantenedores com suas responsabilidades;
7. ADR sucessora aceita, ativando o novo modo e substituindo esta decisão.

Perda temporária de CI não altera o modo automaticamente. Exceções seguem o workflow emergencial. Redução durável da capacidade humana exige nova ADR.

## Reversão

Antes do merge, a mudança pode ser revertida com os commits documentais relacionados.

Depois da adoção, esta ADR não deve ser reescrita. Qualquer mudança de modo ou retorno a uma governança de mantenedor único exige ADR sucessora, atualização dos documentos dependentes e preservação do histórico.

## Referências

- `docs/engineering/constitution.md`
- `docs/engineering/workflows/governance-bootstrap.md`
- `docs/engineering/workflows/pull-request.md`
- `docs/engineering/workflows/code-review.md`
- `.github/CODEOWNERS`
