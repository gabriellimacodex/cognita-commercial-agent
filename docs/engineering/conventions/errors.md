# Convenção de Erros

## Estrutura

Erros atravessando limites devem possuir:

- código estável legível por máquina;
- mensagem segura para o consumidor;
- causa preservada internamente;
- contexto mínimo para diagnóstico;
- correlation ID quando aplicável.

## Nomes

- Códigos em `UPPER_SNAKE_CASE`.
- Tipos terminam com `Error`.
- Mensagens não devem conter segredo, SQL, stack ou host interno.

## Classificação

- Validação: input inválido, sem retry.
- Autorização: acesso não permitido, sem revelar recurso protegido.
- Conflito: estado atual impede operação.
- Dependência: falha externa potencialmente recuperável.
- Interno: comportamento inesperado, registrado com causa.

## Tratamento

- Tratar erro na camada capaz de decidir recuperação ou tradução.
- Não capturar apenas para ignorar.
- Não usar exceção como fluxo normal previsível.
- Definir retry somente para falhas transitórias e idempotentes.
