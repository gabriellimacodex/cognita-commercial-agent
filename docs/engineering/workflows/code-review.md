# Workflow de Code Review

## 1. Orientar-se

- Ler objetivo, não objetivos, plano e ADRs.
- Confirmar base e escopo do diff.
- Identificar classe de risco.
- Identificar o modo de governança e o tipo de revisão realizado.

## 2. Classificar a revisão

- **Self-review:** autor revisa a própria mudança.
- **Segunda passagem:** autor repete a revisão depois que o conjunto está estável; reduz viés, mas não cria independência.
- **Revisão assistida:** agente ou automação analisa a mudança e produz evidência; não equivale a aprovação humana.
- **Revisão humana independente:** pessoa elegível distinta do autor avalia a mudança.

No modo `Single Maintainer`, declarar a ausência de independência quando não houver reviewer humano elegível. No modo `Engineering Team`, aplicar as aprovações independentes do workflow de Pull Request.

## 3. Revisar por prioridade

1. escopo e intenção;
2. correção funcional;
3. segurança e integridade de dados;
4. arquitetura e contratos;
5. concorrência, idempotência e falhas;
6. testes;
7. observabilidade e operação;
8. documentação;
9. legibilidade não automatizável.

## 4. Registrar findings

Cada finding deve conter:

- severidade `P0` a `P3`;
- categoria `blocking`, `non-blocking`, `question` ou `suggestion`;
- localização precisa;
- comportamento observado;
- risco concreto;
- condição esperada para resolução.

Não tratar preferência pessoal como defeito. Não duplicar feedback coberto por linter ou formatador.

## 5. Verificar correções

- Reavaliar o comportamento afetado, não apenas a linha editada.
- Exigir teste de regressão para defeito reproduzível.
- Manter thread aberta enquanto o risco persistir.

## 6. Decidir

- Separar o veredito técnico sobre o conteúdo da prontidão para merge.
- Aprovar tecnicamente somente com evidência suficiente e sem finding bloqueante.
- Declarar gates humanos ou automatizados ainda pendentes.
- Solicitar mudanças quando houver finding blocking.
- Declarar limitações da revisão quando parte do sistema não pôde ser verificada.
- Não classificar revisão assistida como aprovação humana.
