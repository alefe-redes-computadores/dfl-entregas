# DFL ENTREGAS V111 R40 — Operação global, UX e eficiência

Base R39 aprovada localmente: 159 suítes PRE-APK. Nenhuma alteração de autenticação, regras Firebase, status de staff, dados persistidos, rotinas de sincronização remota, Firebase APIs nem permissões. O HEAD Git remoto esperado permanece 4a469b8f.

## Mudanças aplicadas

- Rotas: cards mais compactos; rotas encerradas exibem resumo sem barra desnecessária. O detalhe de uma rota fechada recolhe a sequência inicialmente, mantendo expansão paginada reversível. Múltiplos pedidos por parada física permanecem agrupados, sem alterar a ordem canônica.
- Entregas: cards densos e acessíveis; separa situação logística (concluído/pendente) e pagamento (pago/cobrar/pix pendente); cancelado fica explicitamente cancelado e mantém valor operacional zerado. Não muda valores armazenados nem automatiza cobrança.
- Clientes: índice local para agregações de pedidos, elimina busca completa por histórico para cada cliente. Preserva vinculação por customer_id, fallback por nome SOMENTE sem ID, exclusão de teste, cálculo e ranking.
- Caixa de Entrada: ignora IDs iFood/pedido duplicados no próprio texto colado e entre importações. Sem identificador forte, NÃO mistura automaticamente dois pedidos legítimos no mesmo lote; repetição de texto de outro lote ainda é bloqueada como no fluxo anterior. Persistência local/decisão humana preservadas.
- Compras/Estoque: renderização incremental de cards de produtos (35 por lote), sem modificar seleção em lote, quantitativos, validação de compras, recomendações nem ledger. Botoes de selecionar visíveis continuam representando todos os produtos filtrados, não só a janela montada em DOM.
- Loja: atalhos de Entregas e Rotas mais compactos e informativos, com contadores operacionais dos dados do store; sem novas leituras Firestore.
- Testes: R40 adiciona dois verificadores ao PRE-APK (159 -> 161). R18 legado aceita o reset por ID+status, que agora recolhe o detalhe de rota concluída sem abandonar a paginação.

## Atenção e limites

Esta cirurgia é LOCAL. Não configura, ativa ou publica funcionários; não cria listeners, polling, Firestore queries ou push; não altera contratos financeiros gravados. Consultas remotas já existentes continuam para revisão em cirurgias futuras. A redução real de tempos de render precisa de perfil Android/PWA com dados reais; nenhum percentual de ganho foi inventado.

Termux testa TypeScript completo, PRE-APK 161 suites e integridade Git. O Firebase Emulator real continua uma etapa separada. O instalador bloqueia se algum dos 12 arquivos tiver hash divergente da R39; não use `git add .` nem tente contornar a trava.
