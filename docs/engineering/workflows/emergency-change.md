# Workflow de Mudança Emergencial

## Uso permitido

Usar somente para restaurar disponibilidade, conter incidente ativo, impedir perda de dados ou corrigir vulnerabilidade crítica. Pressão de prazo não constitui emergência.

## Fluxo

1. Declarar incidente, impacto e responsável.
2. Delimitar a menor mudança segura.
3. Identificar rollback antes da execução.
4. Obter aprovação humana disponível compatível com o risco.
5. Executar validação mínima que prove contenção sem ampliar dano.
6. Aplicar a mudança por mecanismo auditável.
7. Verificar resultado e monitorar regressão.
8. Abrir PR de reconciliação caso a mudança não tenha seguido o fluxo normal.
9. Produzir postmortem e ações corretivas.

## Regras

- Não usar emergência para ignorar segurança ou esconder mudança.
- Registrar toda exceção ao CEF.
- Rotacionar qualquer segredo exposto durante resposta.
- Reverter imediatamente se a mitigação ampliar o impacto.

## Pós-incidente

Até o prazo definido pelo responsável, completar testes, documentação, revisão e ADRs que foram legitimamente adiados pela contenção.
