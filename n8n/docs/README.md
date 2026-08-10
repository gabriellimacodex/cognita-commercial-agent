# n8n no Épico 01

O n8n existe somente como serviço isolado de fundação. Ele usa SQLite em volume
próprio, expõe readiness local e não recebe credenciais de PostgreSQL ou Redis
da aplicação.

Nenhum workflow ou integração é implementado no Épico 01. Reiniciar o serviço
deve preservar seu estado técnico no volume `n8n_data`.
