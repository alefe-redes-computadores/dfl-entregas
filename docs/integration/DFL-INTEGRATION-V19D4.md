# DFL Integration V19D.4

## Monotonicidade comercial
`order.updated` compara `payload.statusUpdatedAt` (fallback `event.occurred_at`) com o último relógio comercial aplicado.

Evento antigo é autenticado, aceito e registrado no `integration_inbox` com `processing_outcome: ignored_stale`, mas não altera a Delivery. Empate temporal usa `event_id` como desempate determinístico.

A Delivery guarda `site_order_last_event_at` e `site_order_last_event_id`. Registros V19D.3 sem esses campos usam `site_order_status_updated_at` como fallback.

## Batch
O Site ordena candidatos elegíveis por `occurred_at` crescente e `event_id` antes do claim. Isso reduz reordenação normal; a garantia definitiva continua no consumer do Entregas.

## Fronteira
Nada desta proteção altera `route_id`, `completed`, `fulfillment_mode`, `stop_group_id` ou posição logística.
