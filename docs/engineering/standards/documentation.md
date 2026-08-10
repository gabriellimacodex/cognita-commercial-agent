# Padrão de Documentação

## Fonte única

- Definir cada conceito em um único documento canônico.
- Referenciar a fonte em vez de copiar conteúdo.
- Remover ou redirecionar documentação obsoleta.
- Manter links relativos válidos.

## Tipos documentais

- Constituição: princípios e autoridade.
- ADR: decisão específica e consequências.
- Standard: obrigação técnica.
- Convention: forma preferida.
- Workflow: sequência e gates.
- Checklist: verificação.
- Template: estrutura de evidência.
- Runbook: operação reproduzível.
- RFC: investigação arquitetural e disposição conceitual sem autoridade para implementar.
- Documento de produto: intenção e regras do produto.

## Requisitos

- Usar linguagem técnica consistente e termos do glossário.
- Declarar status, versão ou data quando relevantes.
- Atualizar documentação no mesmo Pull Request da mudança.
- Não documentar comportamento inexistente como concluído.
- Separar estado atual de proposta futura.
- Não apresentar RFC como ADR, autorização ou comportamento implementado.
- Incluir exemplos somente quando reduzirem ambiguidade.

## Evidência mínima

- Checklist de documentação.
- Links verificados.
- Documentos afetados listados no Pull Request.
