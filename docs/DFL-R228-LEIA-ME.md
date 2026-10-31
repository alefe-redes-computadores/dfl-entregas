# DFL Entregas — R228 Operação Premium (31/10/2026)

Base exigida: `5b34fc4ff5bc78c46e747688f100e342ee018dcc` (R227).

## Correções

1. **Site → Entregas (alerta Android):** notificação do Site passa a ser imediata, sem `schedule` de 500 ms suscetível a atrasos do Android. O watcher exige evento recente, não do cache, antes de alertar. A Caixa de Entrada e o badge seguem alimentados pelo Firestore independentemente desse filtro.
2. **Cadastro:** após a entrega ser confirmada remotamente, a reorganização automática da rota é executada de maneira não bloqueante, ainda com log de tempo e tratamento de erro. Não transforma baixa/compra em confirmação falsa, nem modifica os locks R93/R94/R95.
3. **Estoque inteligente:** janela com mínimo de sete dias de observação para não tratar uma baixa concentrada como consumo diário regular; margem automática reduzida a 1,5 dia; uso de histórico requer pelo menos quatro dias distintos; crescimento de reposição gradual, preservando configurações existentes e quarentena semântica.
4. **Seleção de produtos em compras:** busca retorna lista alfabética sem agrupamentos prioritários; modal acompanha `visualViewport` durante abertura do teclado; resultado permanece rolável.
5. **Novo produto:** prévia explícita do saldo que existirá após salvar o cadastro. Movimentação de estoque já tinha prévia de saldo após entrada e permanece intacta.
6. **Estoque principal:** radar de reposição recolhível, sem remover dados ou atalhos.
7. **Rota:** feedback imediato de `Movendo parada…` e de `Salvando nova ordem…`, ícone de carga, transição visual de posições no otimizador quando o browser suporta, fallback normal e respeito à preferência de movimento reduzido.

## Observações operacionais

- A R228 **não cria fila offline de escrita** nem marca operações financeiras/estoque como confirmadas antes de o Firestore aceitar. Essa evolução requer testes com dois aparelhos.
- A nota de compra não altera quantidades do estoque até o fluxo original de recebimento/integração.
- Regras Firebase, dados comerciais, permissões e pagamentos não são alterados.
- A parte do **Site** exige cirurgia em outro repositório: prompt separado `PROMPT-DFL-SITE-R228.md`.
- Sem alterações ocultas, sem stage global, sem force push. Se TypeScript/pré-APK não passar, rollback seletivo.

## Smoke test pós-APK

- Novo pedido no Site deve aparecer uma vez na Caixa. Reconectar com pedidos antigos não deve gerar som de novo pedido.
- Cadastrar entrega e medir tempo até voltar à tela; observar reorganização da rota depois, sem reordenar paradas fixadas.
- Buscar **bacon** e **Coca** no seletor com teclado aberto: produto visível e rolável.
- Conferir sugestões de frango, cebolinha, salsicha e tomate; motivo deve mostrar confiança, meta e histórico. Não confundir quantidade-base com quantidade comercial (pacote/fardo).
- Cadastrar um produto com saldo inicial fracionário, validar prévia; testar entrada na Movimentação e saldo após confirmar.
- Mover uma parada e testar otimizador. Feedback persiste até resultado remoto, com fallback de animação.

Observação: com a busca ativa, o botão **Cadastrar novo produto** só aparece quando não existem correspondências; assim ele não empurra um resultado único para trás do teclado.
