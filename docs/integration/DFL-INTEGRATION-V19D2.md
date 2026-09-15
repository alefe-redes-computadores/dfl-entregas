# DFL Integration V19D.2 — Payload compatibility

## Diagnóstico confirmado no commissioning

O primeiro `order.created` real atravessou transporte e autenticação HMAC, mas foi
rejeitado pelo consumer com `Payload DFL Site Order V1 inválido.`

O payload real do Site usa `statusUpdatedAt: null` na criação do pedido. Isso é
semanticamente válido: ainda não houve uma transição administrativa de status.
O consumer V19C exigia incorretamente texto não vazio.

`orderSchemaVersion: 2` **não era a causa**: o contrato já aceita versões >= 1 e a
versão do envelope de integração continua sendo `schema_version: 1`.

## Correção

- `statusUpdatedAt` passa a aceitar `string | null`.
- `null` é aceito explicitamente; string, quando presente, precisa continuar não vazia.
- nenhuma outra validação do payload foi relaxada.
- a persistência server-side remove propriedades `undefined` dos drafts antes de
  gravar no Firestore, preservando `null`, para evitar uma segunda falha após o
  payload ultrapassar o validator.
- identidade externa, Delivery determinística, inbox e transação permanecem iguais.

O evento original deve ser reenviado pelo relay com o mesmo `event_id`; não criar
pedido substituto nem editar manualmente a outbox.
