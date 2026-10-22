# DFL Entregas V111 R55 — Entrega de eventos, diagnóstico e aviso do Site

## Diagnóstico

O endpoint protegido do worker reverso (`app/api/integration/worker/route.ts`) só pode reportar sucesso da etapa de relay quando o processamento informou `ok: true` e os contadores `failed` **e** `unsettled` forem zero. O worker não deve confundir recebimento HTTP 2xx, execução de uma função ou entrega ao Site com confirmação de WhatsApp pelo cliente.

O checkpoint automático de recuperação permanece aberto caso haja eventos gerados com relay não concluído. O indicador `statusRecoveryNeedsReview` representa falha de reconciliação, página cheia, relay pendente/fracassado ou gravação do checkpoint fracassada. A fila de recuperação continua com intervalos e limite de lote já estabelecidos, sem novas consultas.

## Notificações

O único listener de pedidos do Site mantém o filtro incremental em `updated_at` e não ganha polling. Se o pedido já estiver registrado no badge de não lidos, sua atualização não dispara novamente a notificação imediata. Novos pedidos pendentes continuam marcando badge e acionando o aviso conforme preferências e cooldown da camada nativa.

O badge local não é um registro remoto de entrega de notificações nem um comprovante de recebimento; trata-se apenas de idempotência de apresentação por dispositivo.

## Limites

- Não modifica pedidos, estoque, valores, integração real, credenciais nem estados do Firestore.
- Não cria listeners, triggers, crons ou leituras adicionais.
- Não altera as Firestore Rules, nenhuma flag de staff ou permissões.
- Proteção de concorrência e idempotência entre dispositivos ainda depende dos sistemas remotos existentes.
- A execução completa de TypeScript, PRE-APK e Emulator deve ser feita nas plataformas apropriadas antes de qualquer publicação.
