# DFL Integração V20B — Outbox Relay Reverso

## Objetivo
Transportar com retry os eventos `dfl_entregas -> dfl_site` que já estejam em `integration_outbox`.

## Segurança
- execução server-side via Firebase Admin;
- endpoint de drain protegido por `DFL_REVERSE_RELAY_TRIGGER_SECRET`;
- assinatura HMAC SHA-256 sobre `<timestamp>.<body>`;
- o segredo de assinatura continua sendo `DFL_INTEGRATION_SIGNING_SECRET`;
- apenas eventos operacionais reversos com `source_system=dfl_entregas` são elegíveis.

## Confiabilidade
Estados: `pending -> processing -> sent`, com `failed`, retry exponencial e `dead_letter`.
Locks abandonados podem ser recuperados depois da janela configurada.
O batch é ordenado por `occurred_at` + `event_id`.

## Variáveis
- `DFL_REVERSE_INTEGRATION_RELAY_ENABLED=true`
- `DFL_SITE_INTEGRATION_URL=https://dafamilialanches.com.br/api/integration/events`
- `DFL_REVERSE_RELAY_TRIGGER_SECRET=<segredo exclusivo>`
- `DFL_INTEGRATION_SIGNING_SECRET=<mesmo segredo compartilhado já usado na integração>`
Opcionais: `DFL_REVERSE_RELAY_BATCH_SIZE`, `DFL_REVERSE_RELAY_TIMEOUT_MS`,
`DFL_REVERSE_RELAY_LOCK_MS`, `DFL_REVERSE_RELAY_MAX_ATTEMPTS`.

## Limite deliberado
A V20B não altera o store operacional e não produz eventos automaticamente.
A tomografia solicitada não trouxe o arquivo que contém `startRoute`, `updateDelivery`
e `reorderDelivery`; ligar produtores sem esse código violaria o contrato de atomicidade.
A próxima fase conecta os produtores reais depois de inspecionar esse arquivo.
