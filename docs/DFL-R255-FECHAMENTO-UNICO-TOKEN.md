# DFL Entregas — R255 / Fechamento do achado da homologação conjunta

**Base:** R254 (`bce477ce31d361420e2741510e74e9b740e557b7`). **Site:** R253 (`676fb34b14d042d42e4e4bd97c38af4848fe29e2`).

## Problema confirmado

A auditoria Entregas R254 × Site R253 passou 7 suítes de compatibilidade, mas `exchangeToken()` permitia criar mais de uma sessão para o mesmo token enquanto o grant permanecesse ativo. Isso violava a política de troca única.

## Correção

- `issueGrant()` marca novo grant e índice como `exchange_policy: single_use_v1` e vincula `grant_generation` ao índice, **sem persistir token em texto puro**.
- `exchangeToken()` valida índice, tenant, hash, política, geração, status e vencimento **dentro de `adminDb.runTransaction`**.
- `tx.update(indexRef,{consumed_at:...})` e `tx.create(sessionDoc,...)` pertencem à **mesma transação Firestore**. Se a transação falhar, nenhum dos dois efeitos é confirmado.
- Na segunda troca, inclusive após respostas repetidas e concorrentes, `consumed_at` bloqueia outra sessão. A sessão válida continua consultável; revogar o grant invalida imediatamente todas as sessões vinculadas à geração.
- Tokens antigos que não têm marcadores de `single_use_v1` são rejeitados, pois não podemos provar se já foram trocados. **Isto invalida links antigos, se houver**, sem interferir na operação de entregas.
- Não há novos campos públicos, endpoints, regras Firestore, índice composto, checkout, mensagens, WhatsApp, Finance ou credenciais.

## Proteções de ativação

A R255 **não altera nem ativa** `DFL_TRACKING_GATE1_ACTIVE`, `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED`, `DFL_SITE_TRACKING_ENABLED`, `DFL_TRACKING_BRIDGE_PROBE_CERTIFIED`, modo/capabilities, links públicos ou mensageria. A mudança fica publicada no backend mas inerte enquanto flags existentes permanecerem OFF.

## Testes

- `scripts/test-r255-single-use-exchange.cjs`: testes sem rede e sem Firestore real; múltiplas tentativas concorrentes, replay, sessão válida, revogação, tenant diferente, adulteração, token legado, geração de grant e aborto de transação.
- `scripts/test-r249-gate1-tracking.cjs`: regressão do contrato de sessão, HMAC, ledger, schema e revogação.
- PRE-APK completo, TypeScript integral e auditoria estática Firestore: obrigatórios no Termux antes do push; o instalador bloqueia e reverte seletivamente se falharem.
- Auditoria conjunta R254 × Site R253: já executada pelo operador, 7 suítes PASS e 2 requisições S2S simuladas. Deve ser reexecutada no fechamento.

## Pendente para liberação pública

Realizar homologação efetiva entre servidores protegidos com credenciais efêmeras, tenant dedicado e pedidos fictícios, incluindo handshake R254, emissão pelo administrador, troca única, status, sessão aberta revogada, isolamento de empresas, falhas de rede e Android/PWA. **Sem testes reais e sem autorização explícita separada, não ativar clientes nem enviar notificações.**

## Segurança operacional

O sistema continua sem fallback para credenciais em texto, sem logs de tokens e sem retorno de token na reemissão. Os relatórios devem conter somente hashes, contagens e resultados; não inserir segredos nos logs ou na conversa.
