# DFL ENTREGAS — R232-R2 / GATE FINAL DE IDENTIDADE E APK

Base exata: `fe543a773a7d536854c7c08d692ebeea44654d7a` (R231 publicada).

## Cirurgia e por quê

O cadastro manual de entregas tinha `Date.now().toString()` como ID, incluindo a primeira linha de múltiplos pedidos. Dois aparelhos ou ações muito rápidas poderiam tentar criar documentos diferentes com o mesmo ID. **R232 substitui somente o gerador local** por `crypto.randomUUID()` com fallback criptográfico e, para WebViews antigos, contador+tempo+entropia. A identidade comercial canônica iFood/99Food é preservada pelo `deliveryImportDocumentId` dentro da store. A Caixa de Entrada Site permanece transacional e explícita; nenhum pedido de teste é criado pelo pacote.

O PRE-APK recebe uma suíte R232 com 27+ verificações: colisão de IDs, código de integração, comportamento de rotas, diário de pendências, baixa/desfazer, contrato do workflow Android, assinatura estável e ausência de deploy de regras. Todos os testes antigos R228–R231 continuam cadastrados.

## Escopo e limites

Alterados: `app/entregas/nova/page.tsx`, `scripts/pre-apk.cjs`.
Novos: `lib/operation/manual-delivery-id.ts`, `scripts/test-r232-final-operation-gate.cjs`, dois documentos em `docs/`.

**Não altera** Firestore Rules, integração do Site, parser iFood/99Food, pagamentos, saldo, agenda, permissões, PWA ou a Action Android. Não cria fila extra nem roda emulador/serviços em produção.

O instalador confere `main`/HEAD/GitHub, working tree limpa, checksums, backup, patch ancorado, suíte R232, regressões críticas, TypeScript integral, PRE-APK inteiro, allowlist, commit e push seletivos. Falha antes do commit restaura todos os arquivos alterados. Caso push falhe depois do commit, preserva o commit e o backup para recuperação manual.

## Qual é o próximo marco?

Depois da R232 aprovada, **não é necessário outra cirurgia de funcionalidades por padrão**. Acompanhar a Action `Build Android APK DFL Entregas`, baixar seu artefato `DFL-Entregas-RUN-SHA`, confirmar a assinatura, instalar nos dois aparelhos e executar `docs/DFL-R232-HOMOLOGACAO-FINAL.md`. Somente incidentes efetivamente reproduzidos devem gerar R233.

`tsc` e PRE-APK passarem não significa APK compilado ou dois aparelhos aprovados. Nada será anunciado como pronto até existir evidência real desses passos.


## Correção R232-R2 (31/10)

A execução da R232 original foi bloqueada apenas no contrato da Caixa de Entrada.
O teste procurava uma chamada `allocateSiteDelivery(` dentro de `SiteInboxPanel.tsx`,
mas o componente corretamente obtém essa ação por meio do alias `allocate` e
chama `await allocate(delivery.id, ...)`. A R2 confirma o vínculo à store,
`siteInboxProjection`, a validação `siteAllocationPreflight` antes do commit e
a transação real `allocateSiteDelivery` no store. **Nenhuma mudança em arquivos da
integração Site, Firestore Rules ou pedidos existentes.**

É um pacote consolidado baseado no commit R231 (R232 não foi publicado).
Instalar só R232-R2; não requer aplicar R232 nem executar outro script.
