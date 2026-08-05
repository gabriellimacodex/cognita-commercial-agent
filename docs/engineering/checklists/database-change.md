# Checklist de Mudança de Banco

- [ ] Fonte de verdade e ownership dos dados estão claros.
- [ ] Migration possui uma responsabilidade principal.
- [ ] SQL é explícito e revisável.
- [ ] Compatibilidade com versão anterior foi avaliada.
- [ ] Locks, duração, espaço e volume foram considerados.
- [ ] Dados existentes possuem estratégia válida.
- [ ] Índices e constraints estão justificados.
- [ ] Backfill está separado quando necessário.
- [ ] Reversão segura existe ou sua impossibilidade está documentada.
- [ ] Backup e restauração foram considerados para risco destrutivo.
- [ ] Migration foi testada em estado representativo.
- [ ] Verificação pós-migration está definida.
- [ ] Nenhuma migration aplicada foi reescrita.

Fonte normativa: `standards/data-and-migrations.md`.
