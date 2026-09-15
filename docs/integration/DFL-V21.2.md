# DFL V21.2 — Tracking semântico / rota real

Vínculo de rota não significa rota iniciada.

- `delivery.assigned` pode informar rota, motoboy e total estrutural de paradas.
- `stopsAhead` e `nextStop` só têm significado operacional após `started_at` ou `departure_time`.
- A Rota Geral de Recuperação continua sendo projeção visual/local; não representa saída real.
- `delivery.completed` continua prioritário.
- Rota iniciada mantém `delivery.next_stop` para a primeira parada física pendente e `delivery.position_changed` para as demais.
- O agrupamento físico continua por `stop_group_id`, com fallback no delivery id.
- Nenhum ETA/GPS é inferido.
