# Convenção de Logging

## Campos comuns

Quando aplicáveis, usar:

- `service`
- `environment`
- `version`
- `event`
- `requestId`
- `correlationId`
- `durationMs`
- `errorCode`

## Eventos

Nomear eventos em `snake_case`, no passado para resultados e no presente para estados duradouros, por exemplo:

```text
request_received
job_published
job_processing_failed
shutdown_started
```

## Níveis

- `debug`: diagnóstico detalhado desabilitável.
- `info`: transição operacional normal relevante.
- `warn`: degradação ou condição recuperável que requer atenção.
- `error`: operação falhou ou estado esperado não foi alcançado.
- `fatal`: processo não pode continuar com segurança.

## Restrições

O conteúdo permitido e a redaction são definidos em `../standards/observability.md` e `../standards/configuration-and-secrets.md`.
