# DFL Entregas V111 R31 — Identidade e Revogacao Premium

Cirurgia local visual/fluxo administrativo, sem ativar funcionarios.

## Escopo
- Central Equipe: remove atalho Google duplicado e substitui dois selects nativos por StaffChoicePicker.
- Cadastro: dialogo de suspensao com palavra SUSPENDER; retorno a rascunho NAO ativa conta.
- Homologacao Google: etapas verify, preview, stage preservadas; seletor premium, indicadores e confirmacao PREPARAR.
- Revogacao: confirmacao REVOGAR, perfil/UID exibidos, resposta obsoleta descartada quando UID alterado, toast e haptics.
- Seguranca: padronizacao com StaffPageHeader, StaffPanel, StaffMetric e StaffNavRow.
- Fundacao: StaffChoicePicker pesquisavel para listas grandes, teclado Escape, labels e area de toque >=44 px.

## Garantias e limites
- Servidor mantém as APIs R23 e R24; nenhuma rota API foi alterada.
- O lote nao toca em routes, deliveries, customers, stock_products, stock_supplies ou Firestore Rules.
- Flags staff desligadas, contas suspensas, owner-only em producao.
- Testes locais estruturais nao substituem homologacao em Android e segundo login real.
- Todos os changes ficam locais, sem commit/push/deploy; APK apenas apos publicacao separada.
- Android: toasts usam lib/operational-toast (haptics no nativo), toques sutis via staffTouch.

## Manual de verificacao visual quando publicar em staging
1. Equipe e permissoes: atalho Google uma unica vez; filtros, criar/editar, seletores de motoboy e integrante.
2. Cadastro suspenso: abrir dialogo, cancelar, confirmar digitando SUSPENDER; rascunho nao concede login.
3. Homologacao: selecionar rascunho, informar UID, verificar Google, conferir preview, preparar com frase PREPARAR.
4. Revogacao: conferir UID, alterar UID durante consulta (nao aceitar identidade antiga), checkbox, dialogo REVOGAR; validar pendencias.
5. Rotacao Android/PWA: teclado, labels, safe-area, toasts e vibracao apenas nativa.
6. Firebase Rules continuam somente proprietario; nao publicar regras candidatas automaticamente.
