# DFL V111 R27 — Caixa de solicitações operacionais (SEM efeito canônico)

- Após R26: regras candidatas aprovadas nos 73 cenários do Firebase Emulator, **não** publicadas em produção.
- Novo endpoint `POST /api/access/operations`: autorização pelo Firebase Admin Auth com checagem de revogação (`verifyIdToken(token,true)`).
- Solicitações do funcionário exigem `DFL_STAFF_OPERATION_REQUESTS_ENABLED=true` no servidor, além de `staff_accounts/{uid}.status=active`, permissões de escrita, papel permitido, projeção correspondente existente, vínculo de motoboy e validação dos documentos atuais da entrega/rota ou produto. Flag desligada por padrão.
- Solicitação de conclusão = `delivery_confirmation`. NÃO dá baixa; não atualiza clientes, não faz route-kick, não altera confirmação iFood, não fecha rota.
- Solicitação de compra/entrada = `purchase_intent`. NÃO grava `stock_supplies`, NÃO altera `stock_products`/`stock_movements`, nem executa ledger. Quantidade é uma sugestão, sem valores financeiros.
- Gravação idempotente por `uid + requestId`, dentro de `adminDb.runTransaction`. Cada requisição é isolada ao próprio funcionário.
- Tela do superadministrador: Mais > Equipe e Permissões > Solicitações da equipe. Ação de revisão registra somente análise humana e auditoria, jamais aplica a operação.
- Staff API usa Admin SDK e portanto ignora Rules: controles obrigatórios vivem no **servidor**.
- Coleção `staff_operation_requests` continua owner-only via Rules R26; funcionários não podem lê-la nem escrever nela diretamente.
- O cliente de staff não renderiza as ações enquanto a conta estiver suspensa. O acesso de funcionários ainda depende da política de origem R25, Rules publicadas em fase futura, vínculo de UID e autorização explícita.
- Nenhum commit/push, publicação de Rules, deploy, flag ou ativação por este instalador.

## Pendências de R28

1. Implementar mutações canônicas do servidor respeitando histórico de cliente, Site reverse integration, iFood, ledger de estoque, auto-fechamento e idempotência entre dispositivos.
2. Criar testes de integração Firebase Auth/Firestore reais em projeto demo para rotas `staff_operations`, incluindo corrida suspensão x request, colisão de idempotência e escalada de papel.
3. Criar pipeline de atualização contínua de projeções; atualmente os dados só são preparados sob demanda na R23.
4. Homologar contas e domínios dedicados em dispositivos distintos antes de publicar Rules ou ativar funcionários reais.
