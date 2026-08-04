# Fronteiras do n8n

## Pode

- receber webhook;
- validar assinatura técnica;
- normalizar payload;
- enviar WhatsApp;
- consultar agenda;
- criar reunião;
- atualizar CRM;
- enviar alertas;
- executar retries seguros.

## Não pode

- definir qualificação;
- decidir score;
- decidir próxima melhor ação;
- manter memória principal;
- conter política comercial crítica;
- enviar mensagem sem comando autorizado.

## Padrão de workflow

Cada workflow deve declarar:

- input;
- output;
- credenciais;
- idempotência;
- retries;
- erros;
- callback para API;
- versão.
