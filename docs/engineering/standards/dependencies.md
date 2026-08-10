# Padrão de Dependências

## Requisitos

- Adicionar dependência somente quando o benefício superar custo, risco e manutenção.
- Preferir biblioteca mantida, documentada e amplamente utilizada.
- Fixar versões diretas exatas e versionar lockfile.
- Usar tags exatas para imagens; digest é recomendado em ambientes controlados.
- Não usar `latest`, ranges amplos ou instalação não reproduzível.
- Revisar licença, manutenção, vulnerabilidades e compatibilidade.
- Remover dependências não utilizadas.
- Evitar duas bibliotecas para a mesma responsabilidade sem justificativa.

## Decisões estruturais

Framework, runtime, banco, fila, ORM, ferramenta de build e plataforma de observabilidade exigem ADR. Atualização de major version exige plano de compatibilidade e pode exigir ADR.

## Evidência mínima

- Justificativa no plano ou PR.
- Versão e fonte verificáveis.
- Testes e build com lockfile congelado.
- Análise de impacto para atualização relevante.
