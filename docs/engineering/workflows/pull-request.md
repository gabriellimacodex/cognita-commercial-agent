# Workflow de Pull Request

## 1. Preparação

- Confirmar branch e intenção principal.
- Identificar o modo de governança ativo pela ADR vigente.
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

- Aguardar o check obrigatório e estável `CEF Governance` quando configurado.
- Reproduzir localmente esse check pelos comandos canônicos de `tools/governance` antes do push.
- Aguardar todo check configurado e obrigatório.
- Investigar falhas; não repetir jobs até mascarar flakiness.
- Nunca substituir manualmente um check existente.
- No modo `Single Maintainer`, quando um check ainda não existir, registrar validação local reproduzível com comando, resultado e limitação.
- No modo `Engineering Team`, CI e verificações obrigatórias precisam existir e estar verdes.

`CEF Governance` é o contrato externo do Ruleset. Os validadores internos e seus nomes não são gates independentes de merge.

## 5. Revisão

- Solicitar reviewers compatíveis com o risco e CODEOWNERS.
- Declarar se a revisão é self-review, segunda passagem, assistida ou humana independente.
- Responder questions com evidência.
- Corrigir findings blocking.
- Não resolver thread sem tratar o conteúdo ou obter concordância.
- Não representar revisão de agente como aprovação humana.

## 6. Aprovação

Exigir em qualquer modo:

- zero findings P0/P1 abertos;
- zero findings `blocking` abertos;
- critérios de aceite demonstrados;
- documentação atualizada;
- riscos, limitações e rollback registrados quando aplicáveis;
- todo check configurado aprovado.

### Matriz por modo

| Gate | Single Maintainer | Engineering Team |
|---|---|---|
| Pull Request | obrigatória | obrigatória |
| Self-review integral | obrigatório | obrigatório |
| Revisão humana | usar reviewer elegível quando disponível; ausência declarada quando não houver | pelo menos uma aprovação independente para risco baixo ou médio |
| Constituição, segurança, dados destrutivos ou risco crítico | decisão humana explícita, ADR quando aplicável, segunda passagem, riscos e rollback | duas aprovações humanas independentes |
| CI configurado | obrigatório e verde | obrigatório e verde |
| Check inexistente | validação local reproduzível e limitação declarada | não satisfaz o gate |
| Merge pelo autor | permitido sem representar autoaprovação | sujeito às aprovações independentes aplicáveis |

No modo `Single Maintainer`, self-review ou revisão assistida não se torna independente por ser executada em outra sessão. O mantenedor registra a limitação e decide o merge sob sua autoridade explícita.

## 7. Merge

- Preferir squash merge.
- Usar título compatível com Conventional Commits.
- Não representar decisão do autor como aprovação independente.
- Aplicar os gates do modo ativo antes do merge.
- Confirmar rollback e verificação pós-merge quando aplicáveis.
