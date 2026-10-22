# DFL Entregas V111 — R46 (local)

## Caixa de Entrada
- Filtros pendentes/revisar/prontos com contadores globais preservados.
- Renderização progressiva de 40 rascunhos; os demais continuam armazenados e disponíveis.
- Nenhum rascunho é lançado automaticamente e nenhum pedido foi removido da deduplicação.

## Estoque / Compras
- Memoização do valor estimado do estoque por snapshot de produtos.
- Validações e itens selecionados em Compras memoizados; continuam validando toda a seleção, mesmo fora do filtro/tela.
- Texto de seleção em lote esclarece que a ação cobre todos os produtos do filtro, inclusive os ainda não renderizados.

## Rotas / Entregas
- Valor econômico da rota continua separado da cobrança do cliente. A receber considera apenas pedidos não pagos e não cancelados; pode incluir Pix ou cartão, não equivale a dinheiro vivo.
- Cards de entrega destacam o valor de cliente como recebido ou a receber de acordo com estado financeiro real, sem inferir quitação pela conclusão.

## Equipe: limite da R46
- Continua suspensa. Não alterar Rules, configurações, contas nem flags nesta cirurgia.
- Para teste externo de Motoboy, Operação, Compras e Personalizado, executar Emulator real, revisar isolamento e obter autorização de publicação.

**A instalação R46 não executa deploy, commit, push, migração, alteração de Rules ou ativação de contas.**
