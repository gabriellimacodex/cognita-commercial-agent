# Máquina de Estados

## Princípio

Toda oportunidade deve ter um estado explícito e transições permitidas.

## Regras iniciais

- Novo → Em contato
- Em contato → Diagnóstico
- Diagnóstico → Qualificação
- Qualificação → Qualificado | Nutrição | Desqualificado
- Qualificado → Agendamento
- Agendamento → Reunião marcada
- Reunião marcada → Reunião realizada | No-show | Cancelada
- Reunião realizada → Proposta | Nutrição | Perdido
- Proposta → Negociação | Perdido
- Negociação → Ganho | Perdido

## Restrições

- Nenhuma transição inválida pode ser persistida.
- Toda transição deve registrar ator, motivo e timestamp.
- IA pode propor; regras determinísticas aprovam ou bloqueiam.
