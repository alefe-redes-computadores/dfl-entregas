# DFL V22.2 — Intake e identidade Site → Entregas

## Objetivo

Eliminar o `get()` da coleção inteira de `customers` durante `order.created`
e tornar o vínculo externo de Customer a autoridade após a primeira associação.

## Regras

- `integration_external_identities` de `dfl_site/customer/<id>` é autoritativo.
- Pedido externo continua gerando Delivery determinística por `orderId`.
- Nunca há merge por nome.
- Primeira associação pode reutilizar Customer por telefone exato normalizado.
- Se telefone coincidir mas endereços presentes divergirem, a associação automática
  é recusada em vez de fundir silenciosamente.
- Sem vínculo seguro, cria Customer determinístico do Site.
- Guest sem `customerSnapshot.id` continua isolado por pedido.
- Inbox e identidade do pedido preservam idempotência.
- `order.updated` mantém proteção monotônica contra regressão.
- Nenhum full scan de `customers` permanece no intake.
- Esta versão não muda autoridade comercial nem cria agrupamento automático de parada.

## Custo de leitura

O caminho comum de cliente já vinculado lê documentos determinísticos:
inbox, identidade do pedido, Delivery, identidade do Customer e o Customer apontado.
A primeira associação usa consultas `phone == valor` limitadas, em vez de ler a coleção inteira.
