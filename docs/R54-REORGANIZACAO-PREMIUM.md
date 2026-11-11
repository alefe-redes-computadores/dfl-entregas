# DFL Entregas — R54 · Mais, Preferências 360 e Loja como centro administrativo

## Fonte e critérios

Base remota verificada em 11/11/2026: R53 `227b959b9ecbdd094793cb53bc6636db3c88a273`.

- Mais: menos cartão duplicado, títulos técnicos removidos, seção de acesso direto e diagnóstico protegida por superadmin, conta resumida e logout mantido.
- Preferências: editor claro de regras persistidas individualmente, sem `select` nativo. Rotas manuais continuam prevalecendo, modalidades dos marketplaces só valem para novos cadastros; o lembrete do Site é visual e não envia WhatsApp.
- Loja: Site/Caixa primeiro; entregas e rotas por data; compras, estoque e despesas sempre acessíveis; clientes/equipe/motoboys juntos em bloco expansível. Confirmações e histórico permanecem acessíveis.
- Abertura manual, SiteAdminHub, expediente, pausa, feriados, localização/origem, relatório, finanças e editores antigos não foram removidos; links com hash levam à autoridade operacional.
- Home e centrais P360 de Notificações e Atualizações mantidas intactas nesta etapa, para reduzir risco enquanto a Loja passa a ter organização coerente.

## Limites

Cirurgia visual/navegacional; não altera persistência, Firestore, pedidos, clientes, pagamentos, estoque, roteirização, mensageria, Supabase, notificações nem tracking. Compilação Android somente via GitHub Actions após publicar.

## Aceite

Verificar manualmente Loja (abrir/fechar, Site, Caixa, entregas, rotas, compras, estoque, despesas, clientes, equipe, motoboys), Preferências (gravação e recarga), Mais (permissões, atalhos) e expediente em Android. Gates no Termux são pré-condição, não substituem QA visual.

## R54-R4 | Tomografia PRE-APK (11/11/2026)

A auditoria de 349 suites apontou 15 falhas de contratos de navegacao e strings estruturais legadas apos R54-R1. R4 restabelece destinos com `router.push` explicito, links de Loja, labels acessiveis, guarda admin, e Radar legado preservado mas oculto; os editores e os servicos permanecem intactos. O lint roda com config isolada `eslint-config-next/core-web-vitals` porque o Next 14 inicializa um assistente e gerou localmente `.eslintrc.json` invalido. Nenhuma suite e desativada.
