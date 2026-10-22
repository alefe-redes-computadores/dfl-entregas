# DFL V111 R50 — Auditoria global: iFood, Abastecimentos e Despesas

## Escopo
- Central iFood: relacionamentos por índices efêmeros, preservando a primeira ocorrência do histórico. Não há novos listeners nem leituras Firestore.
- Fila de confirmações: somente código específico da entrega compõe o status **pronto**. Código histórico do cliente nunca autentica um novo pedido.
- Central iFood: locks síncronos por pendência para resolver, invalidar ou restaurar, e lock síncrono para salvar lote; preservação do feedback, status e rotas.
- Abastecimentos: primeiro filtros baratos; só monta busca de itens quando usuário pesquisar; fornecedor indexado para cards.
- Despesas: mês alvo calculado uma vez e cache de datas por objeto para ordenação; valores, filtros e lançamentos preservados.
- PRE-APK: 182 verificadores preservados, 2 novos, sem duplicação. Revisor R49 atualizado para >=180 e não recusar evolução.

## Liberação
- NÃO modifica Rules de produção, Firebase/Auth, flags, contas, serviços, deploy ou banco.
- Firebase Emulator: **não executado** neste pacote; regras candidatas seguem não homologadas no ambiente real.
- A instalação em si não autoriza equipe nem publicação.

## Validação
- 10.604 comparações comportamentais do índice/confirmacão e 26 contratos R50 na cópia local.
- PRE-APK integral e TypeScript completo são exigidos no Termux. Simulações do instalador não contam como execução real.
