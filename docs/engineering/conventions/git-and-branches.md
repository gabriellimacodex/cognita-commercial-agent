# Convenção de Git e Branches

## Branches

Usar nomes curtos em inglês:

```text
feat/<description>
fix/<description>
refactor/<description>
docs/<description>
test/<description>
chore/<description>
```

## Práticas

- Partir da branch padrão atualizada.
- Manter uma intenção principal por branch.
- Não reescrever histórico compartilhado sem coordenação.
- Não incluir arquivos locais, segredos ou artefatos gerados não aprovados.
- Preservar mudanças preexistentes fora do escopo.
- Resolver conflitos entendendo o conteúdo; não escolher lados mecanicamente.

## Merge

- Preferir squash merge.
- Exigir checks e aprovações definidos pelo modo de governança ativo.
- Permitir merge pelo autor somente quando o workflow oficial o autorizar.
- Não representar merge pelo autor como autoaprovação ou revisão independente.
- Excluir branch após merge quando não houver razão para preservá-la.

Regras de proteção efetivas são configuradas no GitHub e devem refletir o workflow oficial de Pull Request.
