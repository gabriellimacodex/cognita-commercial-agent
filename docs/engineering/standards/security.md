# Padrão de Segurança

## Requisitos

- Aplicar privilégio mínimo a pessoas, processos e serviços.
- Validar e limitar toda entrada externa.
- Autenticar e autorizar ações conforme o risco.
- Proteger dados em trânsito e em repouso quando sensíveis.
- Não registrar credenciais, tokens, cookies, dados pessoais desnecessários ou payloads sensíveis.
- Usar algoritmos e bibliotecas de criptografia reconhecidos; não criar criptografia própria.
- Definir rate limit, timeout e limites de tamanho nas fronteiras expostas.
- Avaliar prompt injection e validação determinística quando IA for introduzida.
- Revisar dependências e imagens para vulnerabilidades conhecidas antes de release.
- Registrar eventos de segurança sem expor material secreto.

## Mudanças de alto risco

Autenticação, autorização, criptografia, dados sensíveis, exposição pública e segredos exigem plano, checklist de segurança e revisão humana específica. Decisões estruturais exigem ADR.

## Resposta

Não publicar detalhes exploráveis em issues ou PRs públicas. Escalar vulnerabilidade ativa pelo canal privado definido pela organização.

## Evidência mínima

- Modelo de ameaça proporcional ao risco.
- Testes de autorização e entradas inválidas.
- Verificação de ausência de segredos.
- Rollback ou mitigação de incidente.
