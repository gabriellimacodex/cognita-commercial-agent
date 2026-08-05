# Constituição da Engenharia da Cognita

**Versão:** 1.0.0

**Status:** Ratificada
**Ratificação:** 2026-08-05

## Autoridade

Esta Constituição é a autoridade normativa principal de engenharia deste repositório. Nenhuma ADR, padrão, convenção, workflow, checklist ou template pode contrariá-la.

## Princípios

1. **Segurança e integridade precedem velocidade.** Preservar dados, acesso e capacidade de recuperação antes de otimizar entrega.
2. **Toda mudança precisa de resultado verificável.** Definir objetivo, não objetivos e critérios de aceite antes de considerar uma entrega concluída.
3. **O escopo autorizado é um limite.** Não ampliar uma tarefa por conveniência, oportunidade ou preferência técnica.
4. **Decisões relevantes são explícitas.** Registrar escolhas arquiteturais duráveis e suas consequências por ADR.
5. **Simplicidade é uma restrição de projeto.** Preferir a menor solução que satisfaça corretamente o problema aprovado.
6. **Fontes de verdade são deliberadas.** Definir autoridade dos dados e não permitir estados concorrentes sem estratégia explícita de consistência.
7. **Segredos nunca pertencem ao repositório.** Proteger credenciais, tokens, dados pessoais e material sensível em todos os artefatos.
8. **Mudanças de dados são reversíveis quando possível.** Projetar migrations pequenas, revisáveis e compatíveis com operação segura.
9. **Efeitos externos são idempotentes.** Evitar duplicidade e permitir retries seguros em integrações e processamento assíncrono.
10. **Observabilidade faz parte do comportamento.** Tornar falhas, transições e resultados relevantes diagnosticáveis sem expor dados sensíveis.
11. **Testes provam riscos.** Priorizar evidência do comportamento e dos modos de falha, não métricas de cobertura isoladas.
12. **Documentação faz parte da entrega.** Manter fontes canônicas coerentes com o comportamento vigente.
13. **Falhas devem ser contidas e recuperáveis.** Definir timeouts, tratamento de erros, shutdown e rollback proporcionais ao risco.
14. **Dependências precisam justificar seu custo.** Fixar versões, limitar superfície e evitar bibliotecas sem benefício concreto.
15. **IA não substitui controle determinístico crítico.** Validar saídas e manter decisões críticas sob regras explícitas.
16. **Ambiguidade material interrompe execução.** Solicitar decisão humana quando uma suposição puder alterar escopo, risco, dados ou arquitetura.
17. **Exceções são visíveis e temporárias.** Registrar responsável, justificativa, prazo e caminho de remoção.

## Conformidade

Uma mudança só pode ser aprovada quando atende aos padrões aplicáveis, possui evidências proporcionais ao risco e não contém conflito conhecido com esta Constituição.

## Emendas

Emendar esta Constituição exige:

1. ADR proposta com motivação, alternativas, impacto e transição;
2. aprovação humana explícita conforme o fluxo de revisão;
3. atualização da versão sem apagar o histórico;
4. atualização dos documentos dependentes;
5. registro da data de ratificação.

Correções editoriais que não alterem significado podem usar Pull Request documental, desde que identificadas como não normativas.
