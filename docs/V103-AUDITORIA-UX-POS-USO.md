# DFL Entregas — V103 | Experiência operacional após teste em produção

## Intervenções executadas sobre V102

- **Card de entrega compacto:** valor do pedido rotulado (não confundido com cobrança); parada agrupada informa cobranças e pagamentos pendentes; mapa e WhatsApp não geram atalhos sem destino válido.
- **Card expandido:** resumo direto da parada, endereço, posição, origem, necessidade de código e estado concluído; remove bloco que antes estava inacessível dentro do ramo compacto.
- **Arrastar/deslizar:** movimentação CSS diretamente na superfície (sem rerender do card por pixel), limite seguro para gesto horizontal, rolagem vertical não dá baixa; swipe esquerdo em entrega já concluída não desfaz sem intenção; setas reordenam com bloqueio de operação simultânea e limites.
- **Rota:** agrupamento de paradas reutilizado na prévia, consulta por ID do otimizador em mapa, diagnóstico histórico só na etapa de preparação da rota, resumo explícito de paradas e ganho conforme regra do motoboy.
- **Inteligência pré-rota:** cálculo memorizado; lookup de clientes por índice em vez de buscas repetidas.
- **Extrato e resumo da Loja:** filtros "Confirmados"/"A receber", pesquisa textual, cores do pagamento real em cada linha; duração e ganho calculado (quando a regra permite) no resumo do motoboy; cópia de resumo via ação explícita.
- **Integridade:** nenhum evento financeiro, regra de fechamento, API do Site, bot ou consulta Firebase foi alterado.

## Pendências para avaliação real

1. Medir FPS e deslize em rotas com muitos pedidos no Android; comparar fechamento automático, que continua dependente da confirmação remota.
2. Revisar fluxo de arrastar vertical para reordenar com protótipo dedicado (gesto atual é swipe horizontal com setas para posição; não substituir sem teste).
3. Confirmar mensagens do bot por evento/intenção/worker/WhatsApp com logs do serviço de envio; o status sincronizado no Site não confirma entrega da mensagem.
4. Conferir regras Firestore reais e testes entre dois aparelhos antes de generalizar uso.
5. Validar visualmente os componentes pelo APK atualizado; verificadores estruturais não garantem layout final.

## Segurança do release

- Instalação com hashes da V102, backup persistente e rollback retomável.
- TypeScript completo e PRE-APK obrigatórios no Termux antes de aprovar.
- Nenhum commit/push/deploy/alteração no banco é realizado pelo pacote.
