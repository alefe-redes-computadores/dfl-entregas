# DFL Entregas V111 R60 — Integridade de acertos e financeiro do motoboy

## Problema identificado
A Home podia apresentar acerto pendente incorretamente quando uma rota fechada continha um pedido cancelado no Site. O formulário de acerto também tratava esse cancelamento como entrega pendente. Em registros legados inconsistentes, o cálculo da diária e do dinheiro poderia considerar um pedido cancelado marcado como concluído.

## Autoridade operacional
- A regra de exclusão reaproveita `activeRouteDeliveries`, a mesma usada pelo fechamento de rotas. Somente cancelamentos comerciais do DFL Site são excluídos; um `site_order_status` de outra origem não equivale a cancelamento.
- Se a rota tiver somente pedidos cancelados, **não** gerar acerto automático. A rota precisa estar fechada, ter pelo menos uma entrega ativa e todas as entregas ativas concluídas.
- O histórico do motoboy continua contendo registros cancelados para auditoria; o contador de concluídas e o cálculo financeiro excluem cancelamentos comerciais.
- O acerto manual verifica somente pendências ativas, evitando bloqueios artificiais.

## Performance
- A fila de acertos indexa entregas por rota e despesas por `source_id`; não percorre todo o histórico para cada motoboy.
- O cálculo de diária indexa as entregas concluídas por rota para evitar filtros repetidos, sem mudar agrupamento de paradas por endereço dentro de cada rota.
- O histórico financeiro do motoboy associa entregas a rotas por Map de ID, sem `.find()` por entrega.

## Garantias / limitações
- Os mesmos nomes de motoboy de rotas antigas sem ID continuam a usar a regra legado existente; nenhuma fusão de cadastros foi feita.
- Regras de dinheiro/troco, saldos carregados, adiantamentos e fechamento transacional existente não foram alterados.
- Sem novas leituras Firestore, listeners, novas operações de banco, publicação, alteração em Rules ou ativação de funcionários.
- A R60 adiciona 2 suítes, total 202 PRE-APK. Os contratos V3, V75 e V76 foram adaptados para validar o cálculo indexado e o tratamento de cancelamento sem descartar suas verificações financeiras.
- O ZIP local exige hashes de base R59, 200 suítes, compila TypeScript no aparelho, executa 202 suítes e restaura arquivos modificados se houver erro. Não equivale a testes no Firebase Emulator, que seguem pendentes.
