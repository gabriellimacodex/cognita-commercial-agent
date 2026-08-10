# Workflow de ADR

## 1. Determinar necessidade

Consultar `docs/adr/README.md`. Se a mudança for local, reversível e coberta por decisão vigente, registrar justificativa no plano em vez de criar ADR.

## 2. Reservar número

- Consultar o maior número no índice.
- Usar o próximo número disponível no mesmo Pull Request.
- Não criar arquivos placeholder.

## 3. Redigir proposta

- Copiar `docs/engineering/templates/adr.md`.
- Definir status `Proposed`.
- Descrever contexto, restrições e alternativas reais.
- Registrar consequências positivas e negativas.
- Incluir adoção e reversão.

## 4. Revisar

- Solicitar revisão das áreas afetadas.
- Resolver dúvidas de segurança, dados e operação.
- Não usar implementação como fato consumado para forçar aceitação.

## 5. Decidir

- `Accepted`: decisão autorizada.
- `Rejected`: alternativa não adotada, preservada no histórico.
- Manter `Proposed` quando faltar informação.

**Gate:** somente ADR `Accepted` autoriza a decisão estrutural.

## 6. Adotar

- Implementar em Pull Request relacionado ou subsequente.
- Referenciar a ADR no plano, commits relevantes e PR.
- Atualizar o índice.

## 7. Substituir

- Criar nova ADR.
- Marcar anterior como `Superseded` e apontar a substituta.
- Apontar na nova qual decisão ela substitui.
- Não reescrever justificativa histórica da ADR anterior.
