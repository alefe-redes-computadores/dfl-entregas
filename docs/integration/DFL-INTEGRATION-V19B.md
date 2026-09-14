# DFL Entregas — V19B Consumer Core

## Estado

V19B prepara o consumo determinístico de `order.created` do DFL Site.

Ela NÃO ativa transporte.

Ela NÃO lê o Firestore do Site.

Ela NÃO faz polling.

Ela NÃO adiciona credenciais administrativas ao frontend.

## Auditoria real antes da cirurgia

HEAD auditado:

`e8be3f09e6a31d798ba07362f87a358ab6354a03`

A tomografia confirmou:

- V19A presente;
- TypeScript limpo;
- `origin = ifood | loja` preservado;
- Delivery já suporta `source_system`, `external_order_id`,
  `external_order_schema_version`;
- pickup/counter usam `fulfillment_mode`;
- pickup atual usa `route_id = ''`, endereço vazio e não entra em rota;
- `findExistingCustomer` é conservador e protege conflito de endereço;
- `stop_group_id` é a identidade de parada física;
- criação manual/iFood usa o store atual;
- não existem `firestore.rules`, `firebase.json` ou `.firebaserc`
  versionados no conjunto auditado.

## Decisão de boundary

Por segurança, V19B NÃO conecta `integration_inbox` e
`integration_external_identities` ao Zustand/UI.

Essas collections são infraestrutura interna.

O consumer real será chamado pelo futuro VPS/API/relay privilegiado.

O frontend do DFL Entregas não ganha permissão nova nesta fase.

## order.created

O core valida:

- envelope V1;
- schema_version = 1;
- source_system = dfl_site;
- event_type = order.created;
- entity_type = order;
- entity_id = payload.orderId;
- payload real DFL Site Order V1.

## Delivery determinístico

ID local:

`site-order-v1__<encodeURIComponent(orderId)>`

Além disso:

- origin = loja;
- source_system = dfl_site;
- external_order_id = orderId;
- external_order_schema_version = orderSchemaVersion.

Isso cria uma segunda barreira determinística contra duplicação.

## Pickup

Pickup gera entidade operacional compatível com o modelo atual:

- fulfillment_mode = pickup;
- route_id = '';
- address_string = '';
- maps_link = '';
- sem stop_group_id automático.

Portanto não entra em rota.

## Delivery

Delivery usa o `deliverySnapshot` do Site para formar o endereço
operacional.

V19B não inventa Maps URL porque o payload V1 não fornece coordenadas
nem URL confiável.

`maps_link` permanece vazio até resolução operacional existente/futura.

## Physical stop

V19B NÃO cria `stop_group_id` para pedido externo independente.

Mesmo Customer não significa mesma parada.

Agrupamento posterior deverá ser uma ação/regra operacional explícita
com evidência de destino/contexto.

## Customer

Ordem de decisão do core:

1. ExternalIdentityLink conhecido;
2. heurística conservadora existente somente na primeira associação;
3. Customer novo;
4. criação futura do ExternalIdentityLink no boundary persistente.

Se `customerSnapshot.id` existir, ele é o external customer id.

Sem customerSnapshot/id, o Customer convidado é determinístico por pedido
e não é mesclado agressivamente.

## Idempotência

O core reconhece como já processado:

1. inbox receipt processado;
2. order external identity já apontando para Delivery;
3. Delivery existente com:
   source_system = dfl_site + external_order_id = orderId.

A persistência futura DEVE usar transaction para garantir atomicidade
sob concorrência real.

## Persistência futura obrigatória

O adapter privilegiado deverá gravar na mesma transação lógica:

- inbox receipt;
- order external identity -> Delivery;
- customer external identity -> Customer, quando houver;
- Customer novo, quando necessário;
- Delivery novo.

Se o event_id/order identity já existir, retornar idempotentemente.

## mergeCustomers

O merge atual do Zustand NÃO foi conectado às collections integration_*.

Isso é intencional: as rules reais dessas collections não estão
auditadas/versionadas.

Foi criado um planner de transferência de ExternalIdentityLink.

Antes de ativar consumer em produção, o merge real deve ser movido ou
estendido por boundary privilegiado que transfira os links na mesma
transação e rejeite conflitos.

Até isso ocorrer, consumer permanece NÃO ATIVADO.

## order.updated

O contrato continua reservado, mas V19B não espelha status comercial
para estado logístico.

Nenhuma máquina de estado foi inventada.

## iFood/manual

Nenhum fluxo de criação manual, iFood, rota, stop_group ou Zustand foi
alterado pela V19B.

## Gate para V19C/transporte

Antes de ativar transporte:

1. implementar persistence adapter privilegiado;
2. auditar/deployar rules do DFL Entregas ou manter writes apenas server-side;
3. tornar mergeCustomers efetivamente integration-aware;
4. testar transaction real com evento repetido;
5. só depois ligar relay/VPS.
