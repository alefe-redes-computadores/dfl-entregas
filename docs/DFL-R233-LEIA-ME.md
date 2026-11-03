# DFL Entregas — R233 — Indicadores confiáveis e polimento de operação

Base EXATA: `330ff30363e720c785ac1961623dc3af7e63e906` (R232-R2 publicada).

## Correções incluídas

1. Fonte única de elegibilidade analítica — pedidos de teste antigos (`developer_test`) e novos (`exclude_from_reports`), exclusão explícita por cadastro de cliente e preferência separada para rankings.
2. Marcação manual de pedido de teste tanto na criação como na edição, inclusive históricos, sem deletar o pedido e sem refazer vendas ou estoque.
3. Clientes podem optar por sair de rankings e, separadamente, de indicadores gerais; dados seguem no histórico bruto.
4. Motoboy pode configurar **não exigir acerto** (independente de ser cadastro DEV e do valor ser zero); a central de tarefas deixa de cobrar um acerto impossível.
5. Comprovante de acerto usa o snapshot de ajustes que originou os valores; mensagem e imagem mostram motivos de acréscimos/abatimentos, inclusive após a gravação. Área de rotas/ajustes redimensionada.
6. Cards de entrega: ação de cópia com ícone e descrição acessível, sem texto `C...` espremido.
7. Gráficos por categoria com barras horizontais e labels legíveis no celular; lista limitada à prévia e exploração completa mantida.
8. Tempos iguais/menores que 30 segundos deixam de ser evidência de deslocamento entre paradas; sem inventar 0,0 min.
9. Checklist: resumo iFood sem repetir o aviso em cada parada; mensagem financeira sem chamada redundante; cartões de saída sem `0 Pix a confirmar`.

## Não alterar

- Firestore Rules, Auth, API Site→Inbox, status de pagamentos, valores de diária, estoque, trilha de auditoria, mecanismos de dupla gravação, sincronização e anti-duplicação.
- Registros anteriores não são marcados ou apagados automaticamente. Uma data comercial atípica nunca é excluída automaticamente.
- `exclude_from_reports` afeta projeções e não muda o histórico financeiro/caixa. `exclude_from_rankings` não retira vendas reais dos totais.

## Observações de segurança

- Não usar o campo de perfil interno DEV para representar todo motoboy sem remuneração; agora há `settlement_required`, cuja ausência mantém comportamento anterior.
- Exclusões históricas exigem edição explícita do pedido/cadastro; sem remoção física do Firestore.
- Não marcar pedidos legítimos como teste apenas porque foram feitos fora do horário ou em um dia de volume alto.
- A imagem do acerto mostra tantas linhas quanto couberem no limite de layout; a mensagem textual mantém o detalhamento de todas.

## Gates

Installer verifica HEAD, origin/main, working tree limpa, hashes internos, âncoras exclusivas, backup seletivo, regressão nova, regressões legadas, `tsc --noEmit`, PRE-APK integral, inventário allowlist, stage seletivo, commit + push com verificação remota. Falhas pré-commit restauram arquivos originais.

## Homologar no Android

1. Criar um pedido de teste e verificar que NÃO soma no ranking, horário ou volume. Conferir que permanece na lista histórica e nenhuma transação financeira foi recalculada.
2. Editar pedido antigo e marcar como excluído de indicadores; conferir número anterior e posterior.
3. Marcar cliente como excluído do ranking apenas, manter as vendas reais nos totais.
4. Configurar motoboy como sem obrigação de acerto; fechar rota e conferir que não aparece a pendência.
5. Revisar acerto já registrado com acréscimo e abatimento; motivos visíveis em imagem e texto.
6. Abrir rota com muitos cards: botão copiar ícone, setas e baixa continuam utilizáveis.
7. Ver gráficos de bairros/motoboys no celular, nomes legíveis; tocar para explorar o conjunto.
8. Conferir iFood por pedido e portal, dinheiro em espécie, troco Pix, 99Food e Site com pedidos reais.
9. Abrir PWA e APK em dois aparelhos, com rede intermitente, sem falsos sucessos.
