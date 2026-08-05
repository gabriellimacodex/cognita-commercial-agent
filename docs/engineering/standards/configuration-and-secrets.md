# Padrão de Configuração e Segredos

## Configuração

- Validar configuração no início do processo.
- Falhar rapidamente quando variável obrigatória estiver ausente ou inválida.
- Separar configuração por ambiente sem condicionar comportamento a nomes implícitos.
- Manter exemplos sem valores operacionais sensíveis.
- Documentar unidade, formato e obrigatoriedade.
- Não registrar connection strings completas.

## Segredos

- Armazenar segredos em mecanismo apropriado ao ambiente.
- Nunca versionar credencial, token, chave privada ou segredo funcional.
- Rotacionar segredo exposto e tratar o histórico como comprometido.
- Aplicar privilégio mínimo e escopo reduzido.
- Não reutilizar segredo entre ambientes quando evitável.
- Evitar segredo em argumento de processo, URL, fixture ou screenshot.

## Arquivos locais

Arquivos de ambiente reais devem permanecer ignorados. O arquivo de exemplo define apenas nomes, formatos e placeholders inequivocamente inválidos.

## Evidência mínima

- Validação automatizada da configuração.
- Verificação de segredos antes do merge.
- Redaction testada.
- Procedimento de rotação para credenciais críticas.
