# DFL Entregas — V100.4 | Integridade e preparação para publicação

## Correções aplicadas nesta cirurgia

1. **Movimentação manual e baixas de bebidas**: transação Firestore lê o produto e o registro antes de gravar. Mesmo ID não gera duas saídas/entradas; múltiplos aparelhos usam o saldo atual do servidor. Nenhum saldo é alterado na store antes do sucesso remoto.
2. **Modo saldo restante (manual)**: manda o saldo exibido como condição de concorrência. Se outra pessoa alterou o saldo, a operação não é aplicada e o operador deve atualizar/revisar.
3. **Contagem física**: até 200 produtos por operação em uma única transação, com verificação de saldo inicial por produto. Rascunho e referências iniciais ficam em sessão local. Se o saldo mudou em outro aparelho, a operação inteira falha, sem escritas parciais.
4. **Proteção financeira**: custo médio de entradas é calculado sobre o saldo transacional; quantidades não finitas/negativas, valores abaixo da precisão e saídas acima do estoque são rejeitados.
5. **Pré-release**: auditoria local somente leitura; identifica arquivos pendentes, segredos rastreados e dependências de verificação. Não publica nada.

## Alterações de comportamento assumidas

Movimentações e contagens críticas agora **precisam de conexão com o Firestore para serem confirmadas**. O formulário não deve dizer que gravou quando o servidor não confirmou; dados de sessão da contagem são preservados. O fluxo anterior usava `writeBatch` com atualização otimista e era vulnerável a sobrescrever saldos concorrentes.

A contagem de mais de 200 produtos deve ser dividida em lotes. Não dividir automaticamente, porque isso esconderia operações parciais.

## Verificações antes de qualquer push (não executadas pelo instalador)

- Confirmar Firestore Rules atuais em produção. Regra `allow read, write: if true` é um **bloqueador grave de publicação**. Não aplicar regras arbitrárias sem mapear coleções, autenticação e integração separada com o Site.
- Validar operações reais em dois aparelhos: contagem simultânea, saídas, estorno de compras e conferência do motoboy.
- Testar visualmente Loja, Estoque, Compras, imagem compartilhada, mensagens WhatsApp, retiradas do Site, confirmação iFood e PDF/comprovantes.
- Revisar 100% do diff local acumulado desde V87; arquivos de backups e instaladores não devem entrar no commit.
- Confirmar origem/branch, GitHub Actions/APK, assinaturas, variáveis de ambiente e Vercel. Não executar deploy a partir do instalador.
- Rodar `node scripts/audit-v100-4-release-gate.cjs`, TypeScript e PRE-APK no Termux; fazer teste real no APK antes de publicar.

## Limitações

PRE-APK e TypeScript verificam código e contratos, não simulam concorrência real entre dois clientes Firebase em rede. A auditoria não verifica a configuração remota do Firestore nem o funcionamento do DFL Site. Essas verificações exigem inspeção separada e autorização do operador.
