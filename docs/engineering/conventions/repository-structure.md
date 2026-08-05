# Convenção de Estrutura do Repositório

## Localização por responsabilidade

- `.agents/skills`: Skills CEF específicas do repositório.
- `.github`: integração e templates do GitHub.
- `docs/adr`: decisões arquiteturais.
- `docs/engineering`: governança CEF.
- `docs/*.md`: documentação de produto existente até reorganização explicitamente aprovada.
- `apps`: aplicações executáveis quando autorizadas.
- `packages`: bibliotecas compartilhadas com consumidores concretos.
- `infrastructure`: configuração operacional quando autorizada.

## Regras

- Não criar diretório vazio como promessa de arquitetura futura.
- Não usar diretórios genéricos sem responsabilidade documentada.
- Manter arquivos próximos do componente que os utiliza, salvo fonte canônica compartilhada.
- Evitar barrel exports que ocultem dependências ou criem ciclos.
- Não mover documentação de produto durante mudança não relacionada.

## Novas categorias

Criar nova categoria de primeiro nível somente com justificativa no plano. Mudanças estruturais duráveis podem exigir ADR conforme `docs/adr/README.md`.
