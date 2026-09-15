# DFL Integration V19D.3

## Replay controlado
O Site aceita `replay_sent: true` somente junto de um `event_id` explícito e já `sent`.
O replay reutiliza o envelope original e a assinatura HMAC, mas não modifica status,
attempts, processed_at ou locks da outbox.

## order.updated
O Entregas passa a consumir `order.updated` transacionalmente e com receipt idempotente.
O evento exige ExternalIdentity e Delivery previamente materializadas por `order.created`.
Atualiza somente o snapshot comercial `site_order_status`, `site_order_status_updated_at`,
`external_order_schema_version` e `updated_at`.

`Em Produção` e `Pronto` não alteram route_id, completed, fulfillment_mode,
stop_group_id, posição de rota ou qualquer estado logístico.
