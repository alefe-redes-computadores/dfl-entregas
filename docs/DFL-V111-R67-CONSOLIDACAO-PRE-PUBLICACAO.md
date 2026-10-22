# DFL Entregas V111 — R67 Consolidação Pré-Publicação

**A R67 não publica nada e não libera funcionários.** É uma consolidação do código local até a R66 instalada.

## Integridade reforçada

- A Caixa detecta múltiplos documentos com o mesmo ID externo do Site. Esses pedidos entram em **Revisar**, nunca em **Pronto**, até uma reconciliação segura.
- Cartões com múltiplos pedidos iFood não oferecem código coletivo quando algum pedido não tem código próprio válido ou quando misturam pedidos de outras origens.
- Central iFood e portal de confirmação não truncam códigos com mais de quatro dígitos para fazê-los parecer válidos.
- A Home não contabiliza cancelamentos e retiradas como entregas pendentes de endereço e vínculo.
- Não foram criadas leituras automáticas, listeners, writes ou Rules novas.

## Preparação para publicar (fase POSTERIOR e EXPLÍCITA)

1. **No Termux:** rodar `node scripts/audit-v111-r67-prepublish.cjs "$HOME/storage/downloads/DFL-V111-R67-PRE-PUBLICACAO.txt"`. Conferir branch, HEAD, lista e SHA256 de todos os arquivos locais ainda não enviados. Não usar `git add .` e não incluir `.env`, credenciais, backups, APKs, chaves ou relatórios com dados de clientes.
2. **QA local:** TypeScript e PRE-APK integrados devem passar; depois percorrer rotas, entregas, vários pedidos no mesmo endereço, Caixa Site, manual iFood, compra, estoque, criação, exclusão, rollback local e sincronização offline/online no Android.
3. **Publicação do app proprietário:** somente após autorização expressa, preparar commit seletivo auditado, push do código, conferir Actions e deploy da Vercel e validar APK com assinatura estável. Não misturar alteração das Rules com deploy do app proprietário.
4. **Firebase Emulator:** executar R44 e R64 (owner-only e candidata) com projeto `demo-*`. A existência das Actions não é resultado de teste. Confirmar explicitamente revogação, identidade Google verificada, leitura por área, negação de raiz, compras sem rotas, motoboy sem estoque, Operação e Personalizado.
5. **Rules produção:** manter owner-only até homologação aprovada; comparar regras reais no Console, revisar diffs e publicar candidato apenas com autorização específica. **Nunca** usar `allow read, write: if true`.
6. **Staff:** liberar quatro flags somente de maneira coordenada, começando com uma única conta, privilégios mínimos, sem dados operacionais além do necessário e com teste de revogação/offline. Nenhuma flag é habilitada pelo instalador.
7. **Integração com DFL Site:** verificar V85 e os dois arquivos de integração ainda locais. Pedido novo, duplicação de evento, confirmação tardia, agendamento, balcão, cancelamento antes/depois da rota, saída real, offline/reconexão e alteração comercial posterior. NUNCA assumir status de produção pelo conteúdo de um arquivo local.
8. **Observação:** não chamar o produto de "100% sem bugs" antes de usar o fluxo real. Se algum gate falhar, manter a R66 local ou realizar correção R67.1, sem publicação.

## Checklist de UX

- Tela de Entregas: cards compactos e acessíveis; separar entrega concluída de pagamento pago.
- Rotas: sequência de paradas agrupada por endereço, sem rota sintética para pedido novo do Site.
- Caixa: pedidos recebidos sem duplicar entidades; duplicados externos bloqueados para alocação.
- Estoque/Compras: conferir quantitativos, seleção dos itens fora da paginação, custos, totais, zero e atrasos, sem movimentação ao simplesmente abrir a tela.
- Home: alerta de pendências realmente acionáveis, cancelamentos excluídos, navegação para Caixa.
- Equipe: portal separado, Rules por perfil, flags suspensas até homologação.

**Escopo:** nenhum commit, push, deploy, migração, Rule deploy ou ativação de funcionário durante a R67.
