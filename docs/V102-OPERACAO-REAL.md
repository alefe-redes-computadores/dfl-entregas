# DFL Entregas — V102: correções após uso real (17/10/2026)

## Implementado

- Card de acerto: deixa de exibir vendas genéricas; separa paradas, diárias, acréscimos/abatimentos, dinheiro recebido de clientes, devolução ao caixa e resultado financeiro. Não altera cálculos nem operações de quitação.
- Imagem de checklist: marca DFL real com fallback, densidade adaptada à quantidade de paradas, códigos, Pix pendente, cobranças de cartão/dinheiro e bebidas; mapa só com coordenadas explicitamente válidas.
- Compartilhamento: duas ações principais (imagem ou texto), demais mensagens numa área recolhida. Abrir o compartilhamento não é comprovação de envio.
- Rotas: o fechamento remoto permanece transacional; enquanto o servidor confirma, o card comunica `Conferindo fechamento…` em vez de aparentar travamento. Esta mudança **não promete reduzir o tempo de rede**.
- Rotas/Loja: deixa de confundir valor dos pedidos com ganho do motoboy. Apenas a regra `per_delivery` recebe valor específico por rota. Regras fixas/híbridas permanecem no acerto diário.
- Extrato diário: conclusão logística não se transforma em pagamento confirmado. `receivedTotal` usa a autoridade `deriveDeliveryPaymentState`.
- Notificações de estoque: evita o alerta em foreground verificando `document.visibilityState` e, no Android nativo, `App.getState().isActive`.

## Bot WhatsApp — diagnóstico ainda necessário (bloqueador funcional)

**Não marcar como corrigido apenas porque o status do Site mudou.**

O pipeline tem mais de uma confirmação: `delivery.completed` no DFL Entregas → `reverseOutbox`/`routeKick` → `reversePersistence` no Site → `integration_notification_intents` → `messagingFastLane` (`DFL_MESSAGING_INGEST_URL`/`TOKEN`) → worker/Bot WhatsApp → confirmação de entrega da mensagem ao cliente.

No código público do Site, a projeção do pedido pode ter sucesso e o envio falhar mais à frente. A fast-lane apenas tenta encaminhar o intent e acordar o worker. Não há prova de envio ao WhatsApp no relatório de rota.

Para investigar um caso real de 17/10, usar um pedido do Site **com ID real** e conferir em ambiente autorizado, sem publicar segredos:

1. `integration_inbox`: evento logístico foi consumido e aplicado? Status e `event_id`.
2. `integration_notification_intents`: existe o intent `delivery_completed`/`delivery_started` com `order_id`, qual estado, `attempts`, `last_error` e `messaging_queued_at`?
3. Configuração das variáveis de integração do Site e logs da `messagingFastLane`; **não imprimir tokens**.
4. Fila/processador do bot WhatsApp: pedido recebido, telefone normalizado, resultado do provedor, motivo de falha e idempotência.
5. Só então realizar replay seguro do intent que não foi entregue; não reenviar o pedido nem resetar estado `sent` sem auditoria.

## Pendências para próxima intervenção

- Exportação de ganhos por rota em imagem independente, respeitando regras fixas, híbridas e por parada.
- Renderização no Android atualizado com screenshots reais e revisão do espaçamento e fonte nas imagens de WhatsApp.
- Tempo observado do fechamento remoto: medir separadamente `writeBatch.commit`, `getDocs` e `runTransaction` antes de tentar acelerar a rede sem comprometer integridade.
- Auditoria do bot depende de logs/estado de produção, não apenas do repositório Entregas.
- Validar regras do Firestore em ambiente autorizado.

## Segurança de publicação

Sem commit/push/deploy automático; TypeScript e PRE-APK no Termux obrigatórios. O rollback não altera dados remotos.
