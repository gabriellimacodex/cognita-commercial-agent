# Padrão de Observabilidade

## Logs

- Emitir logs estruturados e pesquisáveis.
- Incluir serviço, ambiente, versão, evento e timestamp.
- Propagar request ID e correlation ID nas fronteiras aplicáveis.
- Usar códigos de erro estáveis.
- Registrar transições relevantes e resultado de efeitos externos.
- Aplicar redaction antes de serializar dados sensíveis.
- Evitar log por item em fluxos volumosos sem controle.

## Métricas e tracing

Adicionar métricas e tracing quando necessários para operar o comportamento, não apenas por padronização. Definir nome, unidade, cardinalidade e responsável por cada métrica.

## Health checks

- Diferenciar processo vivo de serviço pronto quando necessário.
- Usar verificações leves, com timeout.
- Não revelar configuração ou credenciais.
- Não declarar saudável um processo incapaz de cumprir sua responsabilidade principal.

## Alertas

Alertas devem representar ação necessária, possuir responsável e evitar cardinalidade ou ruído sem utilidade operacional.

## Evidência mínima

- Eventos novos documentados no plano ou PR.
- Teste de redaction e falha relevante.
- Caminho de diagnóstico descrito quando a mudança exigir operação.
