# DFL Entregas — R231 | Homologação prática de fechamento

**Regra:** realizar somente pedidos de teste identificados, sem disparar entregas, mensagens ou pagamentos reais. Para testes em produção, não criar saldos ou vendas fictícias sem controle/estorno. Firebase Rules e perfis de staff não são alterados pela R231.

## 1. Publicação e instalação
- [ ] Termux: R231 aprovada, `tsc --noEmit`, PRE-APK completo e push `main` confirmados.
- [ ] GitHub Actions Android acionada no commit correto; build concluído; baixar artefato e verificar SHA/tamanho/assinatura conforme workflow.
- [ ] PWA abre sem tela preta; APK inicia e reabre em cada aparelho; autenticação do proprietário válida.

## 2. Operação de entregas (dois aparelhos)
- [ ] Pedido novo do Site aparece uma vez na Caixa de Entrada, sem rota automática; seleção explícita salva uma única alocação; segundo aparelho vê a mesma rota.
- [ ] Pedido iFood copiado nas duas disposições de cabeçalho reconhece ID/código; pedido 99Food mantém ID de 6 dígitos, origem correta, sem código de confirmação nem rota própria quando entregue pela plataforma.
- [ ] Paradas do mesmo endereço são agrupadas sem perder pedidos. Rota montando maximizada, em rua compacta, concluída/histórico classificados corretamente.
- [ ] Setas de ordem: mudança visual fluida, fila com confirmação separada; parada fixada respeitada; fixar grupo mostra progresso e resultado nos dois aparelhos.
- [ ] Deslizar para esquerda dá baixa (com rota iniciada) e **desfaz baixa concluída** quando permitido; botão continua equivalente; gesto diagonal/curto não confirma acidentalmente.
- [ ] Cancelamento do Site não permite dar baixa, editar ou reabrir comercialmente; relatório mantém tratamento financeiro correto.

## 3. Compras / estoque
- [ ] Busca por bacon, tomate, Cebolinha etc. encontra resultado sem o teclado cobrir o item; produtos aparecem em ordem alfabética.
- [ ] Reposição de itens com pouco histórico não sugere quantidades astronômicas. Respeita mínimo/ideal e unidades comerciais (cartelas, pacotes, unidades).
- [ ] Compra em edição: atualização do PWA **não recarrega** com rascunho ativo; falha mantém rascunho; sucesso libera navegação.
- [ ] Recebimento/conferência só altera saldo após transação confirmada; duas sessões não duplicam lançamentos. Nunca simular estoque real sem possibilidade de ajuste auditado.

## 4. Falha de rede e atualização
- [ ] Interromper internet durante ação não produz toast de confirmação falsa; diário indica pendente, falha ou não verificada.
- [ ] Reiniciar PWA/APK com operação incerta: aviso pede conferência, não reenvia transações.
- [ ] Voltar da tela de fundo com internet: quando houver erro ou operação incerta, uma reconciliação limitada acontece; sem leituras periódicas.
- [ ] Alterar credenciais/conta: diário de uma conta não aparece em outra.
- [ ] O botão de sincronização não transforma falha em “Atualizado agora”.

## 5. Equipe / regras / observabilidade
- [ ] Conferir regras publicadas e papéis em ambiente controlado (motoboy, compras, operação). Auditoria de regras antiga continua **pendência externa** se não homologada.
- [ ] Diagnóstico exibe tempos de gravações, falhas e P90 sem endereços, dados de clientes ou valores no compartilhamento.
- [ ] Confirmar queda/redução de leituras Firestore em comparação com o período anterior (medida no console; não inferir de teste estático).

## Gate
**Não declarar homologação física ou fechamento definitivo até completar e registrar evidências dos itens aplicáveis.** Relatar qualquer regressão com tela, versão PWA/APK, horário, aparelho e síntese do log (sem dados de clientes).
