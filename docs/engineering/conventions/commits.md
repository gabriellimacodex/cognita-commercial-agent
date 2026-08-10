# Convenção de Commits

## Formato

Usar Conventional Commits:

```text
<type>(<scope>): <summary>
```

Tipos permitidos:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`
- `build`
- `ci`
- `perf`
- `revert`

## Regras

- Escrever resumo no imperativo, em inglês e sem ponto final.
- Usar scope quando identificar claramente a área.
- Manter commit autocontido e revisável.
- Não misturar formatação ampla com mudança funcional.
- Explicar motivação no corpo quando não for evidente.
- Identificar breaking change conforme a especificação Conventional Commits.
- Não declarar sucesso de teste não executado.

## Exemplos

```text
docs(cef): add engineering constitution
fix(worker): preserve job state on retry
test(api): cover idempotent job creation
```
