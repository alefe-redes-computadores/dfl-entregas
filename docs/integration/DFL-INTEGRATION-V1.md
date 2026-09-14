# DFL Integration V1 — DFL Entregas

Status: fundação arquitetural V19A.

Esta versão NÃO transporta eventos entre sistemas ainda.

## Ownership

### DFL Site

Autoridade do pedido comercial.

Exemplos:

- carrinho;
- checkout;
- itens;
- subtotal;
- desconto;
- total;
- cupom;
- fidelidade;
- estado comercial antes da execução logística.

### DFL Entregas

Autoridade operacional/logística.

Exemplos:

- Delivery;
- Route;
- motoboy;
- route_id;
- stop_group_id;
- ordem de rota;
- início real de rota;
- conclusão operacional;
- parada física;
- acerto operacional.

### VPS/Bot

Futuramente será responsável pelo transporte e pela renderização de mensagens.

O DFL Entregas fornece fatos/eventos.
Não deve duplicar template/regra do WhatsApp.

## Origem comercial x origem técnica

`origin` NÃO será usado como identificador técnico.

Exemplo de pedido do DFL Site:

```ts
{
  origin: 'loja',
  source_system: 'dfl_site',
  external_order_id: '<Pedidos/{id}>',
  external_order_schema_version: 2
}
```

## Pedido, Delivery e parada

São conceitos diferentes.

Pedido comercial:
fonte de verdade = DFL Site.

Delivery:
execução logística = DFL Entregas.

Parada:
grupo físico operacional no DFL Entregas.

Dois Delivery podem compartilhar `stop_group_id`.

A futura posição do cliente deve utilizar grupos físicos,
não a quantidade bruta de pedidos.

## Identidade externa

A identidade externa não fica embutida como fonte única
dentro do Customer.

Coleção:

`integration_external_identities`

Chave determinística conceitual:

`version + source_system + external_entity_type + external_entity_id`

Exemplo:

`dfl_site + customer + UID123`

O documento aponta para:

`customer + CUSTOMER_LOCAL_ID`

Isso permite detectar concorrência/conflito.

As heurísticas de `customer-identity.ts` continuam válidas
somente para a PRIMEIRA associação quando ainda não existir
identidade externa.

Após o vínculo, o ID externo é soberano.

Nunca mesclar automaticamente apenas por nome.

## Delivery externo

Delivery pode registrar:

- `source_system`;
- `external_order_id`;
- `external_order_schema_version`.

O campo `order_id` existente não é substituído.

## Envelope V1

Campos obrigatórios:

- `event_id`;
- `event_type`;
- `occurred_at`;
- `source_system`;
- `entity_type`;
- `entity_id`;
- `schema_version`;
- `payload`.

Campos opcionais:

- `correlation_id`;
- `causation_id`.

## Event ID

`event_id` representa uma ocorrência lógica.

Retry NÃO cria novo event_id.

Eventos operacionais devem utilizar um marcador persistido
da mutação como `occurrence_id`.

Exemplos futuros:

- Route started: `started_at`;
- Delivery completed: `completed_at`;
- Route reordered: `order_updated_at` ou marcador persistido equivalente.

## Outbox

Coleção:

`integration_outbox`

Status previstos:

- pending;
- processing;
- sent;
- failed;
- dead_letter.

O transporte será implementado posteriormente.

Uma mutação de domínio que produza um evento deverá,
quando necessário, persistir domínio + outbox na mesma
transaction Firestore.

Não usar gravação cega que possa resetar um evento
já processado.

## Inbox

Coleção reservada:

`integration_inbox`

Será utilizada pelo consumidor futuro para impedir que
o mesmo `event_id` seja aplicado duas vezes.

## Eventos previstos pelo contrato

Inbound:

- order.created;
- order.updated.

Outbound/futuros:

- delivery.created;
- delivery.assigned;
- delivery.out_for_delivery;
- delivery.position_changed;
- delivery.next_stop;
- delivery.completed;
- delivery.failed;
- route.created;
- route.started;
- route.reordered;
- route.completed.

A presença no contrato NÃO significa que todos já sejam
produzidos pelo aplicativo.

Especialmente `delivery.failed` ainda não possui estado
operacional equivalente no domínio atual.

## Pickup

`fulfillment_mode = pickup` e `counter` continuam separados
de entregas roteáveis.

Não criar Delivery roteável automaticamente para retirada.

## Customer atual

`customer-identity.ts` permanece como heurística de
primeira associação.

Existe atualmente uma possibilidade de concorrência entre
dois aparelhos durante criação manual porque a rechecagem
ocorre no estado local.

V19B não deverá usar essa estratégia isoladamente para
pedidos externos.

## Merge de Customer

Antes de ativar identidades externas em produção,
`mergeCustomers` deverá tornar-se integration-aware.

Um merge não poderá deixar um vínculo externo apontando
para um Customer removido.

Isso será tratado antes/na V19B.

## Segurança

A tomografia V19A não encontrou regras Firestore
versionadas no repositório analisado.

Portanto esta fundação NÃO assume que as coleções
`integration_*` já estejam autorizadas.

As regras efetivamente implantadas deverão ser auditadas
antes de ativar entrada/transporte real.

## Estado desta versão

V19A cria:

- contratos;
- campos externos de Delivery;
- identidade externa determinística;
- outbox/inbox contracts;
- helpers transacionais;
- geração determinística de event_id.

V19A NÃO:

- importa pedidos;
- altera clientes automaticamente;
- gera eventos de rota;
- chama VPS;
- envia WhatsApp;
- muda telas;
- muda regras atuais de iFood;
- muda agrupamento de paradas.
