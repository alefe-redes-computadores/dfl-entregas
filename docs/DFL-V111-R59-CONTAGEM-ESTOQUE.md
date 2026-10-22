# DFL ENTREGAS V111 — R59: Contagem, inteligência de estoque e duplicados

## Contagem física e sincronização
- Uma quantidade herdada da sessão local que coincidia com o saldo **de referência** não é considerada edição humana quando o Firestore apresenta saldo diferente.
- Quantidades de fato editadas preservam o saldo de referência para a transação condicional existente.
- Quando o saldo corrente diverge da referência de um campo editado, a tela sinaliza conflito e bloqueia a operação inteira antes de qualquer escrita. Uma referência ausente e campo editado também resulta em conflito conservador.
- Foco em campo não editado atualiza a referência e o texto conforme o saldo atual. A lista usa os produtos ativos e ordenação antigos.
- Segunda proteção contra toques rápidos e limite de 200 itens por transação; não altera operações existentes nem saldo automaticamente.
- Atenção: o app ainda não inclui um fluxo de resolução granular dos conflitos; a maneira conservadora de continuar é limpar a sessão e recontar. Nenhuma restauração remota de saldos é automática.

## Inteligência de estoque e clientes
- Relatórios: fotografia temporal estabilizada enquanto a tela está visível; ao voltar ao aplicativo atualiza a data de referência. Relatório, totais, consumo e perdas seguem calculados sobre todos os movimentos.
- Relatórios de Estoque: valor total memorizado e ranking apresentado em lotes de 40, mantendo o total e a ordem completos.
- Inteligência de Preços: 40 cards visíveis inicialmente, com expansão progressiva; critérios e amostras originais intocados.
- Clientes duplicados: revisão em lotes de 30, preservando toda a lista e confirmação manual. Bloqueio síncrono contra toques repetidos em Unificar clientes.

## Segurança e validação
- Regra Firestore owner-only, quatro flags e permissões de funcionários preservadas.
- Não adiciona leituras, listeners, cron, migrações, deploys nem movimentações automáticas.
- PRE-APK: 200 suítes; contrato legado V100.4 atualizado exigindo referência condicional do helper em vez de string antiga, sem eliminar verificação.
- O instalador confere base R58 e hashes SHA256, realiza backup e rollback diante de erro. TypeScript e PRE-APK integrados exigidos no Termux.
- Firebase Emulator real e acesso remoto de funcionários continuam pendentes.
