# DFL Entregas V111 R30 — Experiência Premium da Equipe

## Alterações
- Layout compartilhado `StaffPremium` para cabeçalho, cards, métricas, links e estados vazios.
- Diálogo `StaffConfirmDialog` acessível, no tema dark do aplicativo, usado antes de ações operacionais.
- Portal de funcionários substitui `window.alert/confirm` pelos toasts DFL e diálogo visual.
- Vibração leve somente em toques no app nativo por `staffTouch` (sem vibração no PWA).
- A fila administrativa pede `CONCLUIR` para a baixa real de uma entrega.
- Prontidão: métricas, alertas, flags, amostras, atalhos e estados de loading/erro padronizados.
- Compras: seletor expansível, sem select nativo, mantendo vínculo com compra previamente integrada.
- Tela de Equipe e Permissões: 4 atalhos em cards compactos e coerentes.

## Contratos de segurança intactos
- Não muda `security/*.rules`, Firebase online, banco, flags, AuthGuard ou cache offline.
- A API de solicitações continua atrás de `DFL_STAFF_OPERATION_REQUESTS_ENABLED`.
- A execução canônica continua atrás de `DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED`.
- `updateDelivery` do owner permanece a autoridade da baixa; compras somente conciliam entradas existentes.
- Funcionários seguem sem login liberado.
- R30 NÃO contém ativação de funcionários nem sincronização automática de projeções.

## Validação manual futura, sem liberar produção
1. Visite Equipe e Permissões. Verifique os 4 atalhos sem elementos cortados em telas estreitas.
2. Abra Prontidão, toque Atualizar e confira toast, carregando, estado vazio e limitações da amostra.
3. Abra Solicitações: teste diálogo de revisão e dispensa, e cancele sem mutação.
4. Para uma entrega de TESTE controlada e com flag administrativa devidamente configurada, confira que a palavra CONCLUIR seja exigida; não execute em pedido real apenas para testar.
5. Nunca habilite usuário staff nem troque as regras publicadas apenas pela UI; homologar em origem HTTPS separada e usuário próprio.

Sem commit, push, deploy, migração ou publicação de Rules pelo instalador.
