# DFL Entregas V111 R66 — Site → Caixa de Entrada → Rota

Data 22/10/2026. Cirurgia local; NÃO autoriza push, deploy, Rules ou ativação de equipe.

## Decisões de arquitetura

- **Fonte de verdade comercial:** DFL Site. A entrega existente (`site-order-v1__...`, `external_order_id`) não é duplicada por rascunho de Caixa. O Site mantém status, pagamento comercial, produtos, valores e agendamento.
- **Fonte logística:** DFL Entregas. A Caixa projeta registros `deliveries` já sincronizados; não cria outra coleção. `route_id` é atualizado na Delivery existente.
- **Home:** removidos `routesDoDia.push` sintéticos para pendente/sem rota/recuperação. Ações reais na Central abrem a aba Site da Caixa. Vínculos quebrados passam por aviso separado.
- **Alocação atômica:** transação de Firestore lê pedido e rota. Bloqueia pendente, cancelado, não aprovado, agendado para depois, retiradas, balcão, pedidos concluídos, sem endereço e rota fechada/iniciada/de outro dia. Nova rota e `route_id` são gravados na mesma transação. Sem marcar `started_at`, sem kickSiteRoute, sem alterar status comercial nem registro de pagamento.
- **Confirmação comercial:** estados explicitamente liberados conforme lista do `siteInboxPolicy`; estados desconhecidos são *revisar*, não despachar. Ajuste esta lista somente depois de homologar os eventos reais do Site.
- **Paradas múltiplas:** a camada `route-stops.ts` existente agrupa pelo endereço canônico + rota, preservando cada ID e código.
- **Contagem:** `siteInboxProjection` deriva do snapshot de `deliveries` (inclusive ao carregar offline), nunca de `SITE_UNREAD_EVENT` isolado. O localStorage marca apenas que a notificação foi vista. Nenhuma leitura/listener/polling novo.
- **Notificação:** o atalho abre `/loja/caixa-de-entrada?aba=site&pedido=<id>`; o alerta local não garante push com o aplicativo fechado. Teste Android separado é obrigatório.
- **Operação offline:** mostra dados anteriormente carregados. Uma alocação exige conexão e transação no Firestore; uma falha não altera a Delivery nem gera sucesso visual.

## Checklist de homologação (sem simular resultado)

1. Pedido criado, entregue uma vez ou webhook repetido → único ID no banco e na Caixa.
2. Status pendente → aviso na Home/aba Site; **sem opção de alocar**; Admin Site é ação comercial.
3. Pedido aprovado → opção de rota aberta de hoje ou nova rota e motoboy.
4. Atribuir a rota **não** envia 'Saiu para entrega!' ao Site; iniciar rota é outra ação.
5. Cancelar antes de alocar → fila não oferece ação; cancelar depois de alocar → não aparece como entrega ativa na rota.
6. Pedido agendado → aguardar janela de liberação, sem alocar antecipadamente.
7. Retirada/balcão → não aparece na fila logística (permanece na seção de pedidos da Loja).
8. Dois pedidos mesmo endereço → uma parada física, dois pedidos/códigos/pagamentos próprios.
9. Offline → entrega já sincronizada visível; tentativa de alocação falha sem duplicidade. Após reconexão aparece estado persistido.
10. Outro dispositivo confirma/cancela/inicia rota no meio → transação rejeita estado obsoleto.
11. Alteração comercial posterior → `route_id` operacional preservado, valores/comercial continuam vindo do Site.
12. APK fechado → **confirmar empiricamente** se push remoto é entregue. Não pressupor que o listener PWA/Android em memória esteja ativo.

## Exclusões desta cirurgia

- Nenhum código do DFL Site alterado (pendentes de inspeção os dois arquivos locais da integração fora da publicação V85 do Site).
- Nenhuma regra de Firestore, migração, flag, conta da equipe, commit, push ou deploy.
- Firebase Emulator real e E2E com Site/Vercel não foram executados neste ambiente de desenvolvimento.
