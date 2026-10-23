# DFL Entregas V112 — R76: clientes, identidade e performance global

- O schema mantem `phone`, `address`, `neighborhood`, `maps_link` para consumidores legados, acrescentando `phones[]` e `addresses[]` com principal escolhido explicitamente.
- Nao executa backfill no startup nem grava registros antigos sem o usuario editar. A leitura virtualiza os campos antigos como um unico contato/destino. Saves atualizam principal e arrays juntos.
- Endereco e telefone da entrega sao snapshots: escolha de outro destino nao modifica historico de pedidos anteriores.
- O filtro DEV depende de marcacao explicita ou legado com NOME + TELEFONE + ENDERECO completos, sem incluir homonimos so pelo nome. Identidade do motoboy interno requer flag expressa, pois cadastro de motoboy nao possui telefone historico.
- O 99Food permanece em receita/origem e fora da logistica DFL quando a plataforma entrega.
- Testes TypeScript, regressao e PRE-APK completos. Rules de funcionarios nao sao publicadas. Nenhum listener Firestore adicional por card.
- Checklist manual no APK/PWA: editar cadastro legado, segundo telefone, segundo endereco, definir principal, buscar por telefone 2 e rua, escolher destino, criar pedido, verificar snapshot de endereco, consultar ranking, relatorios e filtros, 360px/safe-bottom/teclado.

## Compras / ranking de compradores

- Purchases inserted by the signed-in administrative account now carry a `purchaser_id` UID in addition to the existing display name. The report excludes UID-confirmed owner purchases from the *buyer ranking only*, never from actual expense totals or stock ledger.
- Historical purchase records without purchaser UID are **not automatically inferred from name alone**, because a homonym may be a distinct buyer. No automatic destructive backfill is performed.

## UX da Loja e Equipe

- Removidos os dois atalhos R75 rejeitados: botão `Acerto` individual no card da Equipe e lista de nomes de motoboys na Loja.
- A ficha de cada entregador continua oferecendo abertura e histórico de acerto. A Loja conserva Gestão recolhida e a operação do dia em destaque.
- Acerto premium R75 permanece com modal de exclusão customizado e conferência financeira intacta.
