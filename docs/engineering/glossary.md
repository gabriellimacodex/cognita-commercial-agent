# Glossário do CEF

## Termos normativos

- **Deve:** requisito obrigatório. A não conformidade bloqueia aprovação, salvo exceção formal.
- **Não deve:** proibição obrigatória.
- **Recomenda-se:** padrão preferido; desvio exige justificativa proporcional ao impacto.
- **Pode:** opção permitida, não obrigatória.
- **Exceção formal:** desvio temporário documentado com responsável, prazo, risco e remediação.

## Governança

- **CEF:** Cognita Engineering Framework, conjunto oficial de governança deste repositório.
- **Constituição:** autoridade normativa principal do CEF.
- **ADR:** Architecture Decision Record; registro imutável de uma decisão técnica relevante.
- **Standard:** obrigação técnica aplicável a uma categoria de mudança.
- **Convention:** forma preferida de implementar ou comunicar sem reduzir um Standard.
- **Workflow:** sequência oficial de atividades, responsabilidades e gates.
- **Checklist:** instrumento de verificação; não cria regras novas.
- **Template:** estrutura para registrar evidências de modo consistente.
- **Skill:** instrução operacional versionada para orientar o Codex pelo CEF.
- **RFC:** investigação arquitetural que registra hipótese, contrapontos e disposição sem autorizar implementação.
- **Fonte canônica:** único documento autorizado a definir um conceito.
- **Single Maintainer:** modo de bootstrap em que não existe capacidade para todos os gates humanos ou automatizados do modo de equipe.
- **Engineering Team:** modo em que revisores humanos, CI e proteções satisfazem os gates integrais do CEF.

## Entrega

- **Critério de aceite:** condição objetiva e verificável que define sucesso.
- **Evidência:** resultado reproduzível que demonstra conformidade ou comportamento.
- **Gate:** condição que precisa ser satisfeita para avançar no workflow.
- **Rollback:** procedimento para restaurar estado operacional aceitável.
- **Vertical slice:** fluxo mínimo completo que atravessa as camadas necessárias e produz resultado observável.
- **Breaking change:** alteração incompatível para consumidor, dado, contrato ou operação existente.
- **Dívida técnica:** compromisso consciente que reduz qualidade ou segurança futura e possui plano de correção.

## Risco

- **Baixo:** impacto local, reversão simples e sem alteração de contrato ou dado persistente.
- **Médio:** comportamento interno relevante ou dependência com impacto controlado.
- **Alto:** dados, segurança, contrato público, infraestrutura ou operação compartilhada.
- **Crítico:** risco destrutivo, acesso privilegiado, produção ou reversão incerta.

## Revisão

- **Self-review:** revisão executada pelo autor sobre a própria mudança; não é independente.
- **Revisão assistida:** revisão produzida com apoio de agente ou automação; não equivale a aprovação humana.
- **Revisão humana independente:** revisão realizada por pessoa elegível distinta do autor.
- **Autoaprovação:** representação indevida de decisão do autor como aprovação independente; merge autorizado pelo modo ativo não constitui autoaprovação.
- **Blocking:** achado que impede aprovação.
- **Non-blocking:** melhoria recomendada que não impede aprovação.
- **Question:** pedido de esclarecimento necessário para avaliar a mudança.
- **Suggestion:** alternativa opcional sem defeito demonstrado.
- **P0:** risco crítico imediato, perda de dados ou comprometimento grave.
- **P1:** falha grave de correção, segurança ou operação.
- **P2:** problema relevante de manutenção, teste ou robustez.
- **P3:** melhoria não bloqueante.
