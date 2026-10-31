# DFL ENTREGAS — R224 · FECHAMENTO OPERACIONAL PRÉ-ABERTURA

## Base e limite da cirurgia
- Base exclusiva: R222, commit `98a9974c9787f7bd2ae3571734d58a837959be89`.
- Não modifica regras Firebase, papéis de acesso, dados em nuvem, cobrança, transações, autorização, parsers ou serviço Site.
- Não muda a ordem de confirmação de pedidos agrupados nem faz promessas de offline completo.
- Testes de 282+ suítes e TypeScript completos são bloqueantes; nenhuma publicação se falhar.

## Melhorias
- Diagnóstico de tempos em **Mais > Diagnóstico local**: baixa da parada, gravação crítica, espera na fila local, início e fechamento de rota.
- Amostras locais limitadas a 60, sanitizadas, sem IDs, nomes, valores, emails, endereços, links e sem novas leituras Firestore.
- Medição de sucesso **após** confirmação; falha e parcial aparecem diferentes de sucesso. Exportação no relatório de diagnóstico e limpeza integrada.
- Modais de arquivamento da Caixa Site e leitor de código de barras movidos para portal no `document.body`, com altura dinâmica e safe-area.
- Rodapé do checklist de saída compactado, preservando botão, validações e scroll.
- Sem alteração da fila FIFO R93/R94 e da autoridade transacional R95.

## Checklist de homologação rápida no APK
1. Abrir Caixa Site, arquivar pedido **de teste** (sem executar arquivamento de produção indevido), conferir modal inteiro em Android pequeno com teclado ativo.
2. Abrir leitor de código de barras: câmera liga mediante toque, desliga ao fechar e em segundo plano. Input acessível e sem corte.
3. Abrir checklist de saída com bebidas/troco/pedidos iFood; rolar até o fim, botão sempre alcançável.
4. Iniciar rota de teste, concluir 1 entrega e 2 pedidos na mesma parada; verificar ausência de duplo clique e manter segurança financeira.
5. Verificar Mais > Diagnóstico local: tempos de operação visíveis; copiar relatório sem nomes, endereços ou IDs.
6. Forçar conexão ruim: não mostrar sucesso antes de gravação; falha preserva pedido e apresenta erro. Testar recuperação ao voltar conexão.
7. Dois aparelhos: modificar entrega em outro e tentar baixa com estado antigo — transação deve bloquear; não remover R95.
8. Conferir pedidos Site na Caixa, cópia WhatsApp iFood, estoque e estorno de conferência com proteção contra duplo toque.
9. Conferir versão da Action Android e URL Vercel correspondentes ao mesmo SHA publicado.

## Limitação conhecida e próxima etapa
O Firestore já usa `persistentLocalCache`, mas `runTransaction` requer rede. A R224 **não** muda para offline-confirmar; isso exigirá motor durable/outbox, idempotência, conflitos e testes de concorrência em branch R225. O novo diagnóstico separa o tempo local antes da transação e a duração total da escrita crítica, mas não mede exatamente o RTT de cada pacote de rede.

A operação com rede ausente pode continuar visualmente com dados locais, porém a baixa crítica deve aguardar autoridade remota antes de se tornar definitiva. Não usar R225 experimental em produção sem homologação real.
