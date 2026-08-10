# Checklist do Reviewer

- [ ] Objetivo, não objetivos e risco foram compreendidos.
- [ ] Modo de governança ativo foi identificado.
- [ ] Tipo de revisão e seu grau de independência foram declarados corretamente.
- [ ] Diff corresponde ao escopo declarado.
- [ ] ADRs obrigatórias existem e estão aceitas.
- [ ] Comportamento implementado atende aos critérios de aceite.
- [ ] Segurança e integridade de dados foram avaliadas.
- [ ] Limites arquiteturais permanecem coerentes.
- [ ] Concorrência, idempotência e retries foram considerados quando aplicáveis.
- [ ] Casos de falha possuem tratamento e teste.
- [ ] Observabilidade permite diagnosticar falhas relevantes.
- [ ] Testes provam os riscos principais.
- [ ] Documentação canônica está consistente.
- [ ] Rollout e rollback são proporcionais ao risco.
- [ ] Findings possuem severidade, risco e condição de resolução.
- [ ] Não há P0/P1 ou blocking aberto antes da aprovação.
- [ ] Veredito técnico está separado dos gates restantes para merge.
- [ ] Revisão assistida não foi representada como aprovação humana.

Fonte operacional: `workflows/code-review.md`.
