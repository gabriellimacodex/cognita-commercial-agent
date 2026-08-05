# Convenção de Testes

## Organização

- Colocar teste unitário próximo do módulo ou em diretório de testes consistente com a aplicação.
- Separar integração e end-to-end quando exigirem infraestrutura distinta.
- Nomear `*.test.ts` para unitários e integração; usar `*.spec.ts` quando o runner ou framework exigir.

## Estrutura

- Descrever comportamento observável, não detalhe de implementação.
- Organizar cenário em arrange, act e assert sem comentários redundantes.
- Usar factories pequenas para dados válidos.
- Sobrescrever apenas campos relevantes ao cenário.

## Dados

- Gerar IDs determinísticos quando a asserção depender deles.
- Usar timestamps controlados.
- Não compartilhar estado mutável entre testes.
- Limpar recursos criados pelo teste.

## Asserções

- Preferir asserções específicas.
- Não depender de ordem acidental.
- Verificar efeito persistido quando esse for o comportamento relevante.
- Em falhas, verificar código e consequência, não apenas texto da mensagem.

As obrigações de cobertura por risco estão em `../standards/testing.md`.
