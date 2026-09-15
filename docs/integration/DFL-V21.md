# DFL V21 — Reverse worker
`/api/integration/worker` executa `reconcile -> drain` no servidor, sem acoplar as mutações PWA à outbox.
Autorização Bearer: `DFL_REVERSE_WORKER_SECRET` ou `CRON_SECRET`.
O endpoint é idempotente porque o reconciliador deriva event_id do snapshot operacional e a outbox/inbox mantêm deduplicação.
Nenhum ETA/GPS é inferido. Posição usa grupos de parada física (`stop_group_id`, fallback delivery id).
A frequência do scheduler/VPS fica fora do código para não assumir plano/limites do provedor de deploy.
