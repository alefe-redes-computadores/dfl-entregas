# DFL Integração V20A — canal reverso Entregas → Site

## Escopo
Cria o endpoint autenticado do Site para eventos operacionais do DFL Entregas e a persistência monotônica do snapshot de acompanhamento no Pedido.

## Garantias
- HMAC SHA-256 no contrato `<timestamp>.<body>`.
- Janela de assinatura de 5 minutos.
- Idempotência por `event_id` em `integration_inbox`.
- Monotonicidade por `occurred_at` + `event_id`.
- O evento só pode apontar para Pedido com `sourceSystem=dfl_site`.
- Nenhum status comercial do Pedido é alterado por este consumer.
- Nenhuma estimativa de tempo/GPS é criada.
- Posição é posição de parada física, não quantidade de Deliveries.

## Campos de tracking no Pedido
`deliveryTrackingEvent`, `deliveryTrackingLastEventAt`, `deliveryTrackingLastEventId`,
`deliveryId`, `deliveryRouteId`, `deliveryRouteName`,
`deliveryMotoboyId`, `deliveryMotoboyName`,
`deliveryStopGroupId`, `deliveryStopPosition`, `deliveryStopsAhead`,
`deliveryTotalStops`, `deliveryIsNextStop`, `deliveryCompletedAt`,
`deliveryFailedReason`.

## Fora do V20A
Esta fase não conecta ainda os pontos de mutação do store do Entregas ao outbox.
Não há envio automático, drain, cron ou WhatsApp nesta cirurgia.

## Lado Entregas
`lib/integration/reverse-events.ts` define o snapshot canônico e o builder dos eventos reversos.
Somente Delivery com `source_system=dfl_site` + `external_order_id` pode gerar evento para o Site.
`groupDeliveriesByStop()` é a fonte da posição física e respeita `stop_group_id`.
