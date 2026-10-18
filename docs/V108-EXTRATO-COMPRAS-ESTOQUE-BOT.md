# DFL Entregas V108 — Integridade Premium e Performance

## Escopo verificado (sobre V107)

- Extrato: exclui cancelados da listagem financeira, preservando registros operacionais/históricos. Os totais passam a considerar somente valores econômicos finitos não negativos. Indicador de totais filtrados separa confirmados e a receber; a lista exibe até 40 itens por vez e carrega lotes adicionais sob demanda.
- Estoque: `buildStockRecommendations` indexa movimentações por produto (sem alterar o modelo matemático); a tela reaproveita as recomendações no cérebro e no planejamento por dia, sem recalcular recomendações para cada produto.
- Compras: `indexShoppingPriceHistory` reaproveita histórico de custo por produto no modo supermercado. Valores conferidos ficam separados da estimativa total; o estado de finalização permanece intacto.
- Diagnóstico: apresenta Entregas → Site → WhatsApp, sem alegar que aceitar evento seja confirmação de envio ou de recebimento.

## Limites honestos

- Não corrige o worker do WhatsApp / VPS, nem faz reenvio. Investigar Site e VPS com logs autorizados antes de tocar mensageria.
- Não inclui modificações de regras Firestore, commits, push, deploy ou builds APK.
- Estabilidade de layout/gesto e tempo de resposta perceptível exigem teste no Android; PRE-APK e sintaxe não substituem experiência real.
- TypeScript completo deverá rodar no Termux após aplicar.

## Critérios de teste

- 120 suítes PRE-APK, incluindo V108 que compara recomendação e histórico de preços antes/depois, verifica filtros financeiros, paginação, modo supermercado e diagnóstico.
- Validar no APK: abrir Loja → Extrato do Dia, alternar filtros e datas, confirmar que pedidos cancelados não contam no total nem aparecem na listagem normal; comparar estoque e sugestões antes/depois; conferir compras com itens selecionados.
