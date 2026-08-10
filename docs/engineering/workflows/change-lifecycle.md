# Workflow do Ciclo de Mudança

## 1. Receber e delimitar

- Confirmar objetivo, escopo permitido e proibições.
- Identificar artefatos e sistemas em alcance.
- Classificar risco conforme o glossário.
- Interromper se a autoridade for insuficiente.

## 2. Investigar

- Ler `AGENTS.md`, Constituição e documentos aplicáveis.
- Inspecionar estado atual e mudanças preexistentes.
- Mapear consumidores, dados, dependências e operação afetados.

## 3. Planejar

- Usar o template de plano para mudanças materiais.
- Definir critérios de aceite e evidências.
- Selecionar estratégia de teste e rollback.
- Determinar se ADR é obrigatória.

**Gate:** plano aprovado quando exigido pelo solicitante ou pelo risco.

## 4. Decidir arquitetura

- Executar o workflow de ADR quando necessário.
- Não implementar decisão estrutural enquanto ADR estiver `Proposed`.

**Gate:** ADR `Accepted`.

## 5. Implementar

- Executar somente o plano aprovado.
- Fazer mudanças pequenas e preservar trabalho não relacionado.
- Atualizar testes e documentação no mesmo conjunto.
- Parar diante de descoberta que altere materialmente o plano.

## 6. Validar

- Executar verificações proporcionais ao risco.
- Comparar resultados com cada critério de aceite.
- Registrar limitações e testes não executados.

## 7. Self-review

- Revisar o diff integral.
- Aplicar checklists relevantes.
- Remover artefatos temporários e conteúdo fora do escopo.

## 8. Pull Request e revisão

- Seguir workflows de Pull Request e code review.
- Resolver findings bloqueantes com evidência.

## 9. Merge e verificação

- Confirmar gates, aprovações e rollback.
- Executar verificação pós-merge ou pós-release quando aplicável.
- Registrar follow-ups com responsável e prazo.
