# DFL Entregas V105 — Gestos e desempenho da operação

## Base
V104 validada no Termux. Não substitua arquivos locais que tenham divergido dos hashes.

## Entregas/Rotas
- Reordenação vertical por uma alça explícita no card compacto de parada pendente.
- Arrasto usa Pointer Events, captura do ponteiro, limites por rota e o mesmo `moveDeliveryToIndex` existente.
- A posição alvo destaca a parada de destino; somente ao soltar a operação persiste no Firestore.
- Sem reordenação de rota fechada, fila virtual, parada concluída ou movimento simultâneo.
- Setas continuam disponíveis por acessibilidade e fallback. O gesto horizontal de baixa/expandir permanece separado.
- Nenhum listener Firestore adicional.

## Desempenho
- Índice O(n) por lista imutável de entregas para recorrência dos clientes, com cache WeakMap por versão.
- Cards deixam de refazer O(n) por cliente; seleção O(1) após montagem do índice.
- A gravação da ordem permanece com os contratos existentes de paradas físicas.

## Estoque/notificações
- Produto que cruza de positivo para zero é considerado mesmo quando mínimo cadastrado = 0.
- Alertas individuais mantêm cooldown por produto e severidade (2 horas). Variar a composição dos grupos não gera spam.
- O cooldown só é consumido depois de o Android aceitar o agendamento da notificação.
- Aplicativo aberto não emite notificação de estoque; feedback da operação continua na própria tela.

## Limitações e próximo diagnóstico
- A entrega real das mensagens do WhatsApp depende do DFL Site e do serviço na VPS. Atualizar o pedido no Site não significa mensagem enviada. Esta V105 NÃO afirma corrigir o bot.
- Para diagnosticar sem duplicar disparos, correlacionar **deliveryId / orderId / eventId** do Entregas, `integration_inbox`, `integration_notification_intents` no Site, estado do worker/ingest e logs de entrega no serviço do WhatsApp. Não fazer replay antes de conferir idempotência da intent.
- Há que testar o gesto no APK atualizado, em telas pequenas, com duas entregas no mesmo endereço, parada urgente, rota encerrada e celular sob uso intenso.
- TypeScript completo deve passar no Termux; PRE-APK isolado não é suficiente.

## Publicação
Sem commit, push, deploy ou mutações do banco. Backup e rollback por hash no instalador.
