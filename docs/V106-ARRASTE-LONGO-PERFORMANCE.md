# V106 — Arraste longo e consistência operacional

## Escopo aplicado

- Alça de arraste da parada passa a rolar a janela progressivamente quando o dedo se aproxima das bordas superior/inferior.
- O arraste continua usando captura exclusiva de ponteiro (`pointerId`); finalização continua acionando `moveDeliveryToIndex` apenas ao soltar, e somente quando a posição mudou.
- Cancelamento de ponteiro, perda de captura, término do gesto e desmontagem limpam RAF e destaque visual.
- Posição-alvo é recalculada com `getBoundingClientRect()` após cada rolagem, evitando índice obsoleto.
- `useOptimizedDeliveries` passa a retornar agrupamentos de todas as paradas e pendentes; RouteAccordion os reaproveita, sem reagrupamentos duplicados no mesmo render.
- Alterações do cadastro de clientes invalidam o cache de informações de bairro/endereço e vizinhança.
- Swipe horizontal de entrega, setas de ordem, confirmação iFood e autoridade da gravação permanecem preservados.

## Contratos

A suíte V106 verifica: captura por pointerId, RAF e cancelamento, agrupamento por parada, invalidadores de cliente, compartilhamento de cálculos e ausência de acesso novo ao Firestore nos componentes de apresentação.

## Validação complementar necessária

1. Instalar APK atualizado e testar o gesto com **rotas de muitas paradas**, arrastando da primeira até a última, tanto para cima quanto para baixo.
2. Interromper o gesto pelo botão Voltar, sair da tela e trocar de aplicativo; confirmar ausência de destaque preso e de movimentação involuntária.
3. Reordenar uma parada com dois pedidos no mesmo endereço: os pedidos devem continuar juntos.
4. Alterar endereço/bairro de um cliente vinculado à rota: informações de vizinhança devem atualizar ao retornar.
5. Testar preservação da ordem após fechar e reabrir o app.

## Pendência operacional externa

As mensagens automáticas do bot do Site/WhatsApp seguem pendentes de diagnóstico do serviço de produção. A sincronização do pedido com o Site **não prova** entrega da mensagem. Nenhuma rotina de reenvio foi criada nesta cirurgia para evitar mensagens duplicadas. É necessária observação do evento logístico, criação da intenção, fila, serviço de envio e confirmação do provedor, sem intervir no bot da VPS sem escopo autorizado.

Esta cirurgia não modifica o banco, não cria novos listeners Firebase e não publica o app.
