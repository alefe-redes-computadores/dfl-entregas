# DFL V21.4 — Worker reverso desacoplado

O endpoint `/api/integration/worker` passa a aceitar `mode=all`,
`mode=reconcile` e `mode=drain`. Sem parâmetro, mantém `all`.

Reconciliação e drain são estágios independentes: uma falha de reconciliação
não impede o drain de eventos já persistidos. Erros de quota/
`RESOURCE_EXHAUSTED` são classificados e retornam HTTP 429.

A cadência e o circuit breaker ficam no VPS, sem criar documentos de controle
ou consumo adicional de Firestore.
