# DFL Entregas V19C — Consumer Persistence Boundary

A V19C transforma o core determinístico da V19B em um receptor server-side persistente. O frontend/PWA não consulta o Firestore do Site e não recebe credenciais administrativas.

## Endpoint

`POST /api/integration/events`

O Site envia o envelope JSON original com:
- `x-dfl-event-id`
- `x-dfl-timestamp`
- `x-dfl-signature: sha256=<HMAC-SHA256>`

A assinatura usa exatamente `<timestamp>.<body>` e `DFL_INTEGRATION_SIGNING_SECRET`, compatível com o relay V19C do DFL Site. Timestamp aceita no máximo 5 minutos de diferença.

## Persistência de `order.created`

Uma transação privilegiada lê inbox, identidade externa do pedido, identidade externa do Customer, Delivery determinística e Customers. O plano V19B continua sendo a fonte da decisão de identidade. Na criação, a mesma transação grava:
- Customer novo, somente quando necessário;
- Delivery `site-order-v1__<orderId>`;
- `integration_external_identities` do pedido → Delivery;
- identidade externa do Customer → Customer quando houver ID externo;
- `integration_inbox` processada.

Retry do mesmo evento não cria nova Delivery, Customer, identidade ou `stop_group_id`.

Pedidos diferentes do mesmo Customer podem reutilizar o Customer por ExternalIdentityLink, mas continuam Deliveries independentes. Não existe agrupamento automático de parada física.

Pickup permanece `fulfillment_mode=pickup`, `route_id=''`, sem `stop_group_id` e sem exigir endereço. Delivery preserva o snapshot textual de endereço produzido pelo core V19B.

## `order.updated`

O endpoint reconhece que o contrato existe, porém retorna `422 deferred`. Nenhum status comercial/operacional é sincronizado nesta fase.

## Segurança / ativação

Variáveis server-side do DFL Entregas:
- `FIREBASE_SERVICE_ACCOUNT_JSON`
- `DFL_INTEGRATION_SIGNING_SECRET`

Nenhuma delas pode usar prefixo `NEXT_PUBLIC_`.

No Site, `DFL_ENTREGAS_INTEGRATION_URL` deverá apontar para `/api/integration/events`. **Não ativar o relay ainda** até validar deploy, credenciais e um evento controlado.

## Merge de Customers

A V19C inclui uma guarda server-side para detectar Customer com identidade externa. O merge legado continua client-side e não foi silenciosamente reescrito nesta cirurgia. Enquanto o merge privilegiado completo não for ligado, Customers integrados não devem ser consolidados manualmente; mover links sem transação poderia quebrar identidade referencial.
