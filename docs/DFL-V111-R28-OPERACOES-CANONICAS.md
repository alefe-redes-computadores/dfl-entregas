# DFL Entregas V111 — R28 Operações Canônicas (sem ativação)

## Escopo
- O proprietário poderá reconciliar solicitação de baixa da equipe **somente usando `useAppStore.updateDelivery(id,{completed:true})`**, que já preserva relacionamento com clientes, integração de rota/Site e fechamento automático.
- A API `/api/access/canonical` funciona apenas com token Firebase owner UID verificado, inclusive revogação (`verifyIdToken(...,true)`), e com a flag **server-only** `DFL_STAFF_OWNER_CANONICAL_APPLY_ENABLED=true`. Sem flag: HTTP 403.
- Um `claim_delivery` grava lease temporário de três minutos na solicitação, impedindo duas execuções simultâneas. `complete_delivery` verifica no Firestore a baixa REAL gravada depois do claim e anota auditoria. Uma falha após a baixa **não significa** que o registro não foi concluído: o operador deve conferir antes de repetir.
- Solicitações de compra **não** têm preço, fornecedor ou custos. Por isso nunca se gera compra ou movimento artificial. O admin registra e integra a compra no fluxo atual; depois vincula uma solicitação à compra já integrada, verificando unidade, quantidade e TODOS os movimentos `supply-<supplyId>-<itemId>` existentes no ledger.
- Documento `staff_canonical_receipts/<supplyId>__<productId>` evita reutilizar o mesmo comprovante para várias solicitações do mesmo produto.
- A revisão R27 `reviewed/dismissed` continua sendo exclusivamente revisão, sem alteração de entrega ou estoque, e não pode atropelar lease ativo.

## Limitações intencionais
- O proprietário deve estar com os dados locais sincronizados e conectado. Se o snapshot no Firestore for diferente, a baixa é bloqueada.
- Se o servidor não puder confirmar a gravação, não retirar a solicitação da fila como aplicada sem checagem manual.
- O lease dura três minutos; se expirar após uma baixa real, a solicitação poderá exigir revisão manual. Não repetir baixa automaticamente.
- Conciliação de compras pressupõe registro na unidade canônica do produto; não inferir unidade comercial, conversões ou preços ausentes.
- O portal do funcionário e a API de pedidos R27 seguem DESATIVADOS por padrão; todas as contas seguem suspensas e a produção mantém rules OWNER-ONLY.
- A R28 prepara operação do dono no frontend/back-end, mas **não significa** ativação real nem autorização de funcionários. Fazer teste de ponta a ponta com usuário separado, Firebase Rules publicadas sob aprovação e integrações Site/iFood antes do primeiro login.

## Tests & release
- R28 entra como suíte adicional PRE-APK (146 previstas), somando contratos R21–R27 e 73 cenários já aprovados na Action isolada R26.
- Instalador verifica base HEAD R26.1, R27 exata, TypeScript completo, PRE-APK, diff e não faz commit/push/deploy.
