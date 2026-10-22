# DFL Entregas V111 R51 — Equipe, Relatórios e Loja

## Auditoria e mudanças

- **Equipe de Motoboys:** consolidação em memória por um índice de ID e de nome legado normalizado. Percorre rotas e entregas uma única vez para montar contadores por entregador. A regra de identidade continua sendo o ID quando disponível, e fallback por nome **somente** quando a rota não tem ID. Nomes repetidos e rotas legadas preservam comportamento anterior (inclusive ambiguidades antigas sem atribuição nova).
- **Cards:** composição compacta, sem excesso de azul, estados e foco de teclado visível, filtros `aria-pressed`, totais de rota e concluídas ainda incluem todo o histórico carregado.
- **Relatórios:** memória comportamental pesada apenas quando a aba Geral ou Operação está ativa. Valores e Dados usam somente o modelo existente. O cálculo da hora de maior volume deixa de ordenar toda a lista.
- **Loja:** listas de entregadores ativos e dias de expediente agora são memoizadas para evitar alocações repetidas em edições não relacionadas.
- **Competência dos motoboys:** `Intl.DateTimeFormat` reutilizado com exatamente a mesma localidade e timezone, sem alterar a definição da competência.

## Segurança e estado

Nenhuma chamada extra ao Firestore, listener novo, mudança financeira, gravação, migração, edição nas Rules, flags, contas, deploy ou publicação. A equipe multiusuário permanece desativada em produção. O Firebase Emulator **não** foi executado por esta cirurgia.

## Validação

2 suítes novas: equivalência comportamental da atribuição e teste estático/contratual. Todas as 182 anteriores são preservadas; PRE-APK terá **184 suítes**. TypeScript e bateria completa são obrigatórios no instalador do Termux, que restaura a R50 em caso de falha.
