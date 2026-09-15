# DFL Integração V20C — produtor reconciliável

## Decisão arquitetural
A auditoria do `store/useAppStore.ts` confirmou que as mutações operacionais são feitas
pelo cliente Firebase (`updateDoc`/`writeBatch`). Como as regras de Firestore não estão
versionadas neste repositório, anexar `integration_outbox` aos batches do PWA poderia
fazer uma operação de rota legítima falhar por permissão.

Também seria incorreto fazer `operação -> await enqueue` em duas escritas independentes:
uma queda de rede entre elas perderia o evento.

Por isso V20C usa **reconciliação server-side via Firebase Admin**.

## Funcionamento
O reconciliador lê `deliveries` + `routes`, considera apenas Delivery com
`source_system=dfl_site` e `external_order_id`, calcula o snapshot atual por parada física
(`stop_group_id`, com fallback no Delivery ID), e cria um outbox determinístico.

O `event_id` contém hash do snapshot operacional. Rodar a reconciliação repetidamente no
mesmo estado é idempotente. Mudança real de rota, posição, próxima parada ou conclusão
gera novo snapshot/evento.

## Eventos atuais
- `delivery.assigned`
- `delivery.position_changed`
- `delivery.next_stop`
- `delivery.completed`
- `route.completed` quando aplicável

O início da rota muda naturalmente o snapshot de `assigned` para posição/next-stop.
Não há ETA nem GPS inventado.

## Pipeline
`POST /api/integration/outbox/drain` autenticado:
1. reconcilia por padrão;
2. cria somente outboxes ausentes;
3. executa o relay V20B por padrão.

Pode-se usar `{"reconcile":true,"drain":false}` para commissioning sem enviar,
ou `{"reconcile":false,"drain":true}` para somente drenar.

## Segurança operacional
Nenhuma alteração foi feita em `store/useAppStore.ts`.
A operação da loja continua independente da disponibilidade do Site.
Uma execução futura do reconciliador recupera eventos mesmo após queda/redeploy.
