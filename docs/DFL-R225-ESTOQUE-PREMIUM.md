# DFL Entregas R225-R2 — Estoque Premium, Compras Compactas e Latência

**Base obrigatória:** R224 (`63d1bd1f251931ee1ab2a997ea1664ab8a45d0be`).

## O que muda
- Movimentar estoque: cartões menores, tipos com ícones Lucide, apresentações em lista horizontal deslizante, equivalências e campos secundários recolhíveis. Remove foco automático no teclado ao abrir a tela.
- Atalho **Tudo** só na Saída e Perda, com modo **Quanto saiu**, saldo > 0. Seleciona automaticamente unidade-base, informando todo o saldo (inclusive 3,4 kg); **nunca grava automaticamente**. A confirmação continua obrigatória e transacional.
- Estoque inteligente: previsão da baixa e aviso antecipado para saldo zerado/abaixo do mínimo, apenas usando dados locais.
- Compras: lista mais densa; previsões de prazo preservadas no acordeão “Por que esta sugestão?”. Formulário de compra reduz espaçamentos, preservando dados, conversões e rascunhos.
- Notificações da conferência sequencial: não impedem a navegação depois de persistir o movimento; erros são reportados ao console, e a rotina original de notificação continua protegida por locks e preferências.
- Tempos locais: novas categorias Compra e Movimentação na Central de Diagnóstico (limite de 60 amostras, sem informações pessoais, sem reads Firestore).

## O que não muda
- Transação de estoque (`runTransaction`), validação de saldo remoto, ID idempotente, permissões, rules, pagamentos, integrações e semântica de exclusão.
- Não há confirmação falsa/offline: transações exigem servidor. Gravações simples do Firebase ainda podem aguardar confirmação remota; a implementação de fila durável e estados pendentes exige homologação separada com vários aparelhos e recuperação após restart.

## Homologação real
1. Entrada + 2 unidades e saldo coerente; Saída de 3 unidades e atualização após confirmação.
2. Saldo **3,4 kg**: clicar Tudo, conferir **3,4** com a unidade-base e projeção zero, salvar só se intencional.
3. Produtos em fardo com 12 unidades: selecionar fardo, depois Tudo e confirmar que o sistema converte para **unidades-base**, não fardos.
4. Tentar retirar acima do saldo e comprovar que a validação bloqueia.
5. Verificar alerta de estoque mínimo e notificação somente quando aplicável, sem duplicar.
6. Abrir edição de compra com múltiplos itens, fornecedor, responsável e apresentação; verificar rascunho.
7. Em Mais > Diagnóstico, observar média/P90 e falhas dos novos tipos após operações de teste.
8. Reconexão e dois aparelhos continuam pendências para **nova arquitetura** offline; não simular confirmação definitiva antes de persistir.

## R225-R2 — Correção do bloqueio anterior
- A R225 original parou antes dos testes ao comparar a indentação incorreta de `onBlur` na tela de movimentação.
- Âncora corrigida e demais correspondências críticas reconferidas com a R224 publicada.
- Preserva os mesmos arquivos, melhorias, backup, rollback seletivo e publicação condicionada a TypeScript + PRE-APK.
