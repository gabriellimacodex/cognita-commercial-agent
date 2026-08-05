# ADR 002 — Versionar Skills CEF no repositório

- **Status:** Accepted
- **Data:** 2026-08-05
- **Responsável:** Cognita
- **Substitui:** nenhuma
- **Substituída por:** nenhuma

## Contexto

O Codex precisa aplicar a governança do CEF em tarefas de planejamento, implementação, ADR, revisão e Pull Request. Skills globais não acompanham automaticamente o histórico e a versão do projeto.

## Problema

Escolher onde manter as Skills específicas da Cognita e como evitar que elas dupliquem a documentação normativa.

## Restrições

- Skills precisam ser descobertas no contexto do repositório.
- Mudanças precisam ser revisáveis por Pull Request.
- Conteúdo normativo deve permanecer em `docs/engineering`.

## Alternativas consideradas

### Instalar somente em diretório global do usuário

Rejeitada porque não garante versão consistente entre colaboradores e ambientes.

### Duplicar normas dentro de cada Skill

Rejeitada porque cria múltiplas fontes de verdade e aumenta custo de contexto.

### Versionar Skills concisas em `.agents/skills`

Selecionada porque acompanha o repositório e permite referências à documentação canônica.

## Decisão

Manter as Skills oficiais do CEF em `.agents/skills`. Cada Skill conterá somente workflow operacional e referências explícitas aos documentos oficiais aplicáveis.

## Consequências positivas

- Governança acompanha a versão do projeto.
- Mudanças em Skills são auditáveis.
- Progressive disclosure reduz contexto desnecessário.

## Consequências negativas

- Cada checkout precisa reconhecer Skills locais.
- Skills e metadata precisam ser validadas após alterações.

## Riscos

- Referências quebradas por reorganização documental.
- Skill desatualizada orientar fluxo incorreto.

## Adoção

Criar e validar as seis Skills CEF aprovadas, cada uma com `SKILL.md` e `agents/openai.yaml`.

## Reversão

Nova ADR deve definir localização substituta e plano de migração antes da remoção.

## Referências

- `AGENTS.md`
- `docs/engineering/README.md`
