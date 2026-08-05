# Workflow de Code Review

## 1. Orientar-se

- Ler objetivo, não objetivos, plano e ADRs.
- Confirmar base e escopo do diff.
- Identificar classe de risco.

## 2. Revisar por prioridade

1. escopo e intenção;
2. correção funcional;
3. segurança e integridade de dados;
4. arquitetura e contratos;
5. concorrência, idempotência e falhas;
6. testes;
7. observabilidade e operação;
8. documentação;
9. legibilidade não automatizável.

## 3. Registrar findings

Cada finding deve conter:

- severidade `P0` a `P3`;
- categoria `blocking`, `non-blocking`, `question` ou `suggestion`;
- localização precisa;
- comportamento observado;
- risco concreto;
- condição esperada para resolução.

Não tratar preferência pessoal como defeito. Não duplicar feedback coberto por linter ou formatador.

## 4. Verificar correções

- Reavaliar o comportamento afetado, não apenas a linha editada.
- Exigir teste de regressão para defeito reproduzível.
- Manter thread aberta enquanto o risco persistir.

## 5. Decidir

- Aprovar somente com evidência suficiente e gates atendidos.
- Solicitar mudanças quando houver finding blocking.
- Declarar limitações da revisão quando parte do sistema não pôde ser verificada.
