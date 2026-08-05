# Padrão de Contratos de API

## Requisitos

- Validar request e response nas fronteiras.
- Versionar contratos públicos quando houver risco de incompatibilidade.
- Usar códigos HTTP coerentes com o resultado.
- Definir formato estável de erro com código legível por máquina e correlation ID.
- Não expor stack trace, segredo, host interno ou detalhe de persistência.
- Tornar paginação, ordenação e filtros explícitos.
- Definir idempotência para comandos repetíveis ou sujeitos a retry.
- Preservar compatibilidade ou documentar breaking change e migração.
- Separar handlers HTTP de serviços de aplicação e infraestrutura.

## Mudanças incompatíveis

Breaking changes exigem plano de transição, identificação de consumidores, ADR quando estrutural e aprovação proporcional ao impacto.

## Evidência mínima

- Testes de contrato.
- Exemplos sem dados sensíveis.
- Casos de erro relevantes.
- Confirmação de compatibilidade dos consumidores conhecidos.
