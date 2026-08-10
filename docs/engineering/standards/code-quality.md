# Padrão de Qualidade de Código

## Requisitos

- Manter TypeScript em modo estrito quando aplicável.
- Evitar `any`; justificar e limitar qualquer exceção.
- Validar entradas nas fronteiras do sistema.
- Usar nomes que expressem comportamento e domínio.
- Manter funções e módulos coesos com uma responsabilidade reconhecível.
- Tratar erros de forma explícita e preservar sua causa.
- Implementar shutdown seguro para processos persistentes.
- Remover código morto, flags temporárias vencidas e comentários que repetem o código.
- Preferir fluxo de controle simples a abstrações prematuras.
- Respeitar formatador e linter como autoridade para estilo automatizável.

## Dependências e efeitos

- Tornar I/O e efeitos externos identificáveis.
- Injetar dependências quando isso permitir teste ou desacoplamento real.
- Não ocultar acesso a rede, arquivo ou banco em helpers com nome genérico.
- Definir timeouts para operações externas.

## Exceções

Uma exceção deve registrar motivo, risco, responsável e condição de remoção no plano ou Pull Request. Exceções duráveis a este padrão exigem ADR.

## Evidência mínima

- Build, lint e typecheck bem-sucedidos.
- Testes associados ao comportamento alterado.
- Ausência de warnings novos não justificados.
