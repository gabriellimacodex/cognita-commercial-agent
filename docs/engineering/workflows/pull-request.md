# Workflow de Pull Request

## 1. Preparação

- Confirmar branch e intenção principal.
- Atualizar a branch com segurança.
- Revisar o diff completo contra a base.
- Executar checklists aplicáveis.
- Executar validações e registrar resultados.

## 2. Descrição

Preencher `.github/PULL_REQUEST_TEMPLATE.md` sem remover seções obrigatórias. Relacionar plano, ADRs, issue ou tarefa quando existirem.

## 3. Escopo

- Manter uma mudança principal por PR.
- Separar refactors amplos de mudança comportamental quando isso melhorar revisão.
- Identificar explicitamente qualquer desvio do plano aprovado.

## 4. CI

- Aguardar verificações obrigatórias.
- Investigar falhas; não repetir jobs até mascarar flakiness.
- Documentar teste não executado e motivo.

## 5. Revisão

- Solicitar reviewers compatíveis com o risco e CODEOWNERS.
- Responder questions com evidência.
- Corrigir findings blocking.
- Não resolver thread sem tratar o conteúdo ou obter concordância.

## 6. Aprovação

Exigir:

- CI verde;
- zero findings P0/P1 abertos;
- critérios de aceite demonstrados;
- documentação atualizada;
- uma aprovação humana para risco baixo ou médio;
- duas aprovações humanas para Constituição, segurança, dados destrutivos ou risco crítico.

## 7. Merge

- Preferir squash merge.
- Usar título compatível com Conventional Commits.
- Não autoaprovar.
- Confirmar rollback e verificação pós-merge quando aplicáveis.
