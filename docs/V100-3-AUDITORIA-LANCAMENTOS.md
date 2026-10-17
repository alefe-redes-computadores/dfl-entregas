# DFL Entregas — V100.3 | Integridade de lançamentos e pré-publicação

## Problema auditado

Antes da V100.3, `integrateStockSupply` e `reverseStockSupply` buscavam snapshots por **linha de compra**, sem agrupar por `stock_product_id`. Quando uma compra continha duas linhas do mesmo produto, cada linha partia do mesmo saldo e a atualização da última linha podia sobrescrever o lançamento anterior, apesar de serem registrados dois movimentos.

## Implementação V100.3

- `lib/stock-supply-ledger.ts`: motor puro de lançamentos; agrupa por produto, rejeita ids de linha duplicados, quantidades/preços inválidos e unidades inconsistentes; mantém uma trilha de movimentações por linha com saldos sucessivos.
- `store/useAppStore.ts`: uma leitura e uma atualização por produto distinto dentro de transação; só confirma a store após o sucesso remoto e usa `set(state => ...)` para não restaurar snapshots antigos sobre outras operações.
- Estorno: total de linhas do mesmo produto é conferido com o saldo disponível; movimentos invertidos em ordem, com custo médio recalculado, e custo apagado quando saldo vai a zero.
- `lib/stock-pricing.ts`: análise de preços indexada em uma única passagem pelos itens do histórico. Mantém o custo comparável na unidade-base e os indicadores de amostra/confiança.
- Contagem física: bloqueio de referências repetidas no mesmo lote antes de atualizar a store.
- `scripts/verify-v100-3-stock-ledger.cjs`: testes de comportamento reais, incluindo quantidade fracionária e custos.
- `scripts/verify-v100-3-release-readiness.cjs`: preflight **somente leitura**; valida contratos e identifica possíveis segredos locais rastreados/novos.

## Riscos que permanecem (não afirmar resolvidos)

1. `addStockMovement` ainda parte do estado local e usa `writeBatch`: concorrência entre dispositivos pode exigir uma futura transação por produto/movimento. Não migrado nesta cirurgia.
2. `countStockProducts` mantém operação otimista por batch: o bloqueio de duplicados protege o mesmo lote, mas não resolve concorrência entre operadores/dispositivos.
3. Idempotência e serialização das mutações da mesma compra devem ser observadas em ambiente real com rede intermitente.
4. Segurança: verificar regras Firestore reais ANTES de publicar. Regras abertas (`allow read, write: if true`) não são adequadas à produção. Integrar a migração com os fluxos do Site; não alterar regras às cegas.
5. Mensagens/rota, atendimento, iFood e compras precisam de smoke test no PWA e no APK, além dos testes PRE-APK. Testes de código não comprovam entrega de WhatsApp, persistência online ou UX real.

## Portão de release sugerido (manual; sem publicar automaticamente)

- TypeScript `node node_modules/typescript/bin/tsc --noEmit` sem erros.
- `node scripts/pre-apk.cjs` aprovando 108 suítes e `git diff --check`.
- Inspecionar `git status --short`, `git diff --stat`, diff integral e nomes de arquivos novos; não usar `git add .`.
- Exercitar compra com duas linhas do mesmo produto, estorno, contagem, rota com dois pedidos no mesmo endereço, Pix pendente e confirmação do Site/iFood em ambiente controlado.
- Revisar chaves/segredos e regras Firestore antes do commit/push.
- Commit, push, deploy e APK SOMENTE após autorização explícita do operador.
