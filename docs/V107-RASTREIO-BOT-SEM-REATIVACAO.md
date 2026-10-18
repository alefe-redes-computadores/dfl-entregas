# DFL Entregas V107 — Diagnóstico confiável da mensageria

## Evidência real observável

O evento logístico chega à integração reversa e pode ser marcado `sent` na `integration_outbox`. Esse valor significa apenas resposta HTTP bem-sucedida do Site, **não significa WhatsApp enviado nem entregue**. Depois do recebimento no Site, há a fila `integration_notification_intents`, o fast-lane e o worker da VPS. Somente logs/estado desses componentes permitem identificar a falha final.

## O que esta macro acrescenta

- Consulta manual limitada por ID completo de delivery ou do pedido DFL Site, exclusiva de usuário Firebase autenticado com email permitido em `DFL_ADMIN_EMAILS`.
- **Sem** escrita no banco, reenvio, endpoint anônimo, polling, leitura global ou chamada ao bot.
- Classificador puro para `site_accepted`, `relay_pending`, `relay_failed`, `no_event` e `no_terminal_event`.
- Sem clientes, telefones, tokens, mensagens, credenciais ou payload na resposta e no relatório copiado.
- Integração na tela `Mais > Diagnóstico`; mensagem de sucesso do recovery agora deixa claro que a confirmação é do Site, não do WhatsApp.

## Para descobrir a causa

1. Abrir a ferramenta de rastreio e informar **ID completo** do pedido Site ou delivery (código visual de 8 caracteres não basta). Copiar o diagnóstico.
2. Se houver `failed` / `dead_letter`: olhar erro/horário e autorizadamente corrigir o relay Entregas → Site.
3. Se a saída indicar `sent`: no projeto Site, consultar o evento na `integration_inbox` e o `integration_notification_intents` correspondente. Conferir `messaging_eligible`, `status`, `attempts`, `last_error` e `messaging_queued_at`.
4. Se o intent está no worker, conferir autenticação, webhook e logs da VPS sem tocar no bot de outros projetos.
5. Não ativar reenvio automático até confirmar idempotência entre Site e VPS e a semântica de ack do WhatsApp.

## Limites

- 1 leitura por ID direto + busca exata por `external_order_id` até 2 se não houver ID direto + até 50 eventos da outbox para a entrega. Nenhuma consulta periódica.
- Pedidos com mais de 50 eventos podem produzir diagnóstico parcial; a tela informa esse limite.
- A ferramenta não conhece se o WhatsApp foi entregue. Isso é intencional; não afirmar sucesso ao cliente.
- O fluxo requer publicar nova versão do servidor Vercel, além do APK, porque a API é server-side.
- Regras do Firestore ainda necessitam revisão em produção.
