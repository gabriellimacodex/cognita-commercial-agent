# Workflow de Bootstrap da Governança

## Finalidade

Orientar a operação do CEF enquanto a Cognita ainda não possui capacidade humana e automação suficientes para o modo `Engineering Team`. Este workflow complementa a ADR 003 e referencia os gates definidos no workflow de Pull Request.

## Estado inicial

O modo ativo é `Single Maintainer`.

Nesse modo, uma única pessoa pode concentrar autoria, decisão e merge, mas cada papel precisa permanecer distinguível nas evidências. Concentração operacional não transforma self-review em revisão independente nem revisão de agente em aprovação humana.

## Operação por um único mantenedor

Para cada mudança material:

1. delimitar objetivo, não objetivos, risco e autoridade;
2. executar planejamento e ADR quando aplicáveis;
3. implementar somente após os gates correspondentes;
4. executar validações reproduzíveis;
5. realizar self-review integral do diff;
6. realizar uma segunda passagem depois que o conjunto estiver estável;
7. registrar revisão assistida quando utilizada e declarar sua limitação;
8. aplicar o modo ativo no workflow de Pull Request;
9. registrar riscos, rollback e validações não executadas;
10. manter a Pull Request aberta diante de finding bloqueante ou evidência insuficiente.

Separação temporal reduz viés, mas não cria independência. A Pull Request deve continuar identificando corretamente o tipo de revisão realizado.

## Uso de agentes

Agentes podem planejar, implementar, validar e revisar conforme as Skills do CEF. Seus relatórios podem sustentar decisões, mas não concedem autoridade humana nem contam como aprovação independente.

O mantenedor humano permanece responsável por:

- autorizar escopo e exceções;
- aceitar ADRs;
- avaliar riscos materiais;
- confirmar rollback;
- decidir sobre merge;
- interromper execução quando a evidência for insuficiente.

## Entrada de novas pessoas

Cada novo mantenedor deve receber responsabilidade explícita antes de aparecer em `CODEOWNERS` ou ser considerado reviewer elegível.

A integração deve cobrir:

- leitura do `AGENTS.md`, Constituição e ADRs vigentes;
- entendimento das fontes canônicas e da hierarquia normativa;
- acesso mínimo necessário ao GitHub e aos sistemas relacionados;
- áreas sob sua responsabilidade;
- limites de aprovação e escalonamento;
- participação prática em revisão antes de assumir ownership.

Enquanto os critérios completos do modo `Engineering Team` não forem atendidos, o modo permanece `Single Maintainer`. Revisão humana independente disponível deve ser utilizada sem declarar prematuramente a transição.

## Distribuição de responsabilidades

Ownership deve evoluir de forma explícita e verificável:

1. identificar áreas reais de responsabilidade;
2. confirmar pessoas elegíveis e seus acessos;
3. atualizar `CODEOWNERS` sem aliases fictícios;
4. validar o roteamento de revisão;
5. registrar lacunas ainda concentradas no mantenedor original.

`CODEOWNERS` roteia responsabilidade. Os requisitos de aprovação permanecem no workflow de Pull Request.

## Evolução para Engineering Team

A transição ocorre somente quando todos os critérios da ADR 003 forem demonstrados e uma ADR sucessora for aceita.

A decisão de transição pertence ao mantenedor responsável pela governança, com concordância explícita dos novos mantenedores. Branch protection, CI e regras de aprovação devem refletir o modo somente depois de configurados e validados.

## Perda de capacidade

Saída de mantenedores ou indisponibilidade durável de controles não autoriza downgrade silencioso. Avaliar impacto, preservar proteções seguras e criar nova ADR quando a capacidade deixar de sustentar o modo vigente.

Indisponibilidade temporária de CI deve ser tratada como falha operacional. Não converter checks existentes em evidência manual sem uma exceção formal ou o workflow emergencial.

## Emergências

Mudança emergencial segue `emergency-change.md`. O modo de governança não transforma prazo em emergência nem permite esconder bypass.

Toda exceção precisa registrar autoridade, motivo, risco, evidência mínima, rollback e reconciliação posterior.

## Evidências de maturidade

Antes da transição, registrar:

- mantenedores elegíveis e responsabilidades aceitas;
- `CODEOWNERS` coerente;
- checks obrigatórios estáveis;
- proteção efetiva da branch principal;
- Pull Request de validação;
- procedimento de emergência e recuperação de acesso;
- ADR sucessora aceita.

## Fonte operacional

- Gates e aprovações: `pull-request.md`.
- Revisão: `code-review.md`.
- Decisão de modo: `../../adr/003-single-maintainer-governance.md`.
- Emergências: `emergency-change.md`.
