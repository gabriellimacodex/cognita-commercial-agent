# Padrão de Dados e Migrations

## Fonte de verdade

Definir explicitamente qual armazenamento é autoritativo. Cache, fila e índice derivado não substituem a fonte de verdade sem ADR aceita.

## Migrations

- Manter migrations explícitas, pequenas e ordenadas.
- Dar uma responsabilidade principal a cada migration.
- Fornecer reversão quando tecnicamente segura.
- Não editar migration já aplicada em ambiente compartilhado.
- Separar alteração estrutural de backfill volumoso.
- Avaliar locks, duração, espaço, índices e compatibilidade entre versões da aplicação.
- Usar constraints para invariantes que pertencem ao banco.
- Definir comportamento para dados existentes antes de tornar coluna obrigatória.
- Planejar backup e restauração para mudanças destrutivas.

## Compatibilidade operacional

Preferir sequência expandir-migrar-contrair quando versões antigas e novas puderem coexistir. Não remover coluna ou significado em uso no mesmo passo que introduz o substituto.

## Dados sensíveis

- Minimizar coleta e retenção.
- Não usar dados reais em testes sem anonimização aprovada.
- Definir acesso, retenção e eliminação quando aplicável.

## Evidência mínima

- Checklist de banco preenchido.
- Teste da migration em estado representativo.
- Estimativa de impacto e estratégia de rollback.
- Query ou verificação pós-migration.
