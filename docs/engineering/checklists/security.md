# Checklist de Segurança

- [ ] Superfície de ataque alterada foi identificada.
- [ ] Entradas externas possuem validação e limites.
- [ ] Autenticação e autorização foram verificadas separadamente.
- [ ] Privilégios são mínimos.
- [ ] Segredos permanecem fora do repositório e dos logs.
- [ ] Dados sensíveis foram minimizados e protegidos.
- [ ] Rate limit e timeouts foram considerados.
- [ ] Dependências e imagens foram avaliadas.
- [ ] Mensagens de erro não revelam internals.
- [ ] Cenários de abuso relevantes possuem teste ou mitigação.
- [ ] Rollback ou contenção de incidente está definido.
- [ ] Mudança de alto risco recebeu revisão humana específica.

Fonte normativa: `standards/security.md` e `standards/configuration-and-secrets.md`.
