# V109 — Cards, privacidade, Extrato e operação mobile

## Ajustes reais

- Card compacto de uma parada compartilhada não exibe mais uma lista detalhada de todos os pedidos: há contadores de cobrança e pendência, e o detalhamento continua acessível no card expandido.
- Valores econômicos e valores de cobrança ao cliente são distintos; subsídio de marketplace não é automaticamente um valor que o motoboy precisa cobrar.
- Modo privacidade oculta também valores unitários dos pedidos agrupados e o troco.
- Extrato apresenta por método os totais calculados da própria relação de pedidos válidos (mesma base usada pela listagem), e a linha individual usa o valor econômico normalizado.
- Modais completos da Loja bloqueiam rolagem da tela de fundo e aceitam Escape para fechar.
- Removido cálculo de total da rota sem consumidor visual; não altera persitência nem escrita Firestore.

## Limites

- Não alteramos valores persistidos, regras de remuneração, worker WhatsApp, limites Firestore ou backend do Site.
- Teste manual obrigatório: rota com 2+ pedidos no mesmo endereço, subsídio iFood, pagamentos mistos, modo privacidade, navegação dia no Extrato e visual em Android.
- Não inclui push ou deploy.
