# DFL Entregas V111 R35 — Projeções sob demanda e sincronização segura

## Limite de autoridade

Esta cirurgia não ativa funcionários, não publica Rules, não modifica `deliveries`, `routes`, `stock_products` ou `stock_supplies` e não cria listeners.

- `preview`: proprietário autenticado com `verifyIdToken(..., true)`, Firebase Auth verificado para o UID-alvo, conta `suspended`, rascunho correspondente, snapshot projetado pelo whitelist de R23 e detector de riscos R32. Nunca escreve.
- `refresh`: exige `DFL_STAFF_PROJECTION_REFRESH_ENABLED=true` configurada **no servidor** (desligada por padrão), confirmação do owner, hash da prévia, versão da conta e transação Firestore. Por padrão, indisponível.
- Transação: relê conta e documentos atuais, remove apenas documentos desse UID sem correspondência na nova projeção, grava apenas `title/subtitle/status`, mantém `status: suspended` e registra auditoria. Não concede permissões.
- Amostragem: até 30 rotas atribuídas; entregas das primeiras quatro rotas, 10 por rota; 30 produtos; 30 compras; 1 resumo. Se a base histórica ultrapassar 40 documentos por área, **bloqueia**, não apaga parcialmente.
- Validação de preview via `sha256` de conteúdos + versão; divergências exigem recalcular. Atualização de origem simultânea após a prévia pode exigir reauditoria — não há garantia de snapshot global em múltiplas coleções.
- Nenhum número de telefone, endereço, custo, valor financeiro, dados pessoais ou nome de cliente deve ir ao documento projetado.

## Testes antes de ativação futura

Homologar a API num projeto de teste isolado com Admin SDK e Firestore Emulator, incluindo concorrência, revogação, atualização de conta e redirecionamento de rota. PRE-APK verifica contratos e política pura; **não substitui integração no Emulator**. O botão de atualização não aparece enquanto a flag estiver desligada.

## Sem publicação

O instalador é local, valida os arquivos anteriores e não faz commit, push, deploy, alteração de Rules nem atualização de produção.
