# DFL Entregas V111 — R53 | Autoridade por pedido no iFood e mensagens de rota

## Problema reproduzido por auditoria

A Central de Confirmações (R50) já trata o código como dado da entrega. Entretanto,
`closeRoute` ainda copiava `customers.last_confirmation_code` para uma nova pendência
do iFood quando a entrega não possuía código próprio. O compartilhamento de rotas
por WhatsApp, inclusive o checklist de uma parada com vários pedidos, repetia
esse fallback. Isso podia mostrar um código pertencente a outro pedido como se
fosse válido para uma confirmação diferente.

## Contratos R53

- Um código de confirmação exibido ou gravado na fila pós-rota vem apenas de
  `delivery.confirmation_code` e deve conter **exatamente quatro dígitos**.
- Código salvo no histórico do cliente **não é apagado** nem considerado
  confirmação automática de outro pedido.
- Se uma parada reúne pedidos iFood e apenas um possui código, os demais
  continuam marcados como **pedir código**.
- Pedidos cancelados no Site não geram nova pendência iFood ao fechar rota.
- A fila pós-rota continua idempotente por ID da entrega, respeitando
  confirmações externas já resolvidas e a autoridade remota do fechamento.
- A Mensagem 2 consulta grupos de paradas indexados uma vez, em vez de
  filtrar todas as entregas repetidamente a cada parada.
- A organização automática de rotas usa um mapa de grupos livres, evitando
  `find` repetido para cada parada. Não altera ordem bloqueada e nem gravações.

## Homologação e segurança

- Novo teste comportamental executa geração real das mensagens com dependências
  simuladas, cobrindo códigos históricos, grupo misto, cópia individual, cópia
  agrupada e volume com 600 entregas.
- Verificador V25.2 atualizado para exigir a nova autoridade por pedido —
  contratos de idempotência, confirmação externa e CTA permanecem.
- Não há consultas, listeners ou gravações Firestore adicionais.
- Rules owner-only, flags de funcionários e autenticação não são modificadas.
- Firebase Emulator e teste com funcionário de verdade continuam pendentes.
- Instalação é exclusivamente local. Publicação exige aprovação específica.
