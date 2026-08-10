# Padrão de Testes

## Princípio

Testes devem provar o comportamento e os riscos relevantes da mudança. Cobertura numérica isolada não demonstra correção.

## Requisitos

- Toda mudança comportamental deve adicionar ou atualizar testes.
- Toda correção de bug deve incluir regressão reproduzível.
- Testar caminhos de sucesso, falhas esperadas e limites relevantes.
- Usar dependências reais em testes de integração quando o risco reside na integração.
- Manter testes determinísticos, independentes e legíveis.
- Evitar sleeps fixos; aguardar condições observáveis com timeout.
- Controlar relógio, aleatoriedade e identificadores quando afetarem determinismo.
- Não incluir segredos ou dados pessoais em fixtures.
- Validar contratos entre produtores e consumidores.
- Documentar comandos e pré-requisitos de execução.

## Pirâmide orientadora

- Unitários: regras e transformações isoladas.
- Integração: banco, fila, filesystem ou fornecedor em ambiente controlado.
- Contrato: compatibilidade entre limites.
- End-to-end: jornadas críticas completas.
- Smoke: capacidade básica do artefato integrado.

Escolher a menor camada que prove o risco; não substituir integração crítica por mock conveniente.

## Evidência mínima

- Comandos executados e resultados no Pull Request.
- Explicação para testes não executados.
- Evidência específica para critérios de aceite.
