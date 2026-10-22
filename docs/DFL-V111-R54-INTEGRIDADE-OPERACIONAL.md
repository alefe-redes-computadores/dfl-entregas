# DFL Entregas V111 R54 — Integridade operacional

## Loja / Firestore
- O documento `store/store_settings` é atualizado por uma fila FIFO local: uma gravação não termina depois de uma alteração posterior e a sobrescreve por inversão de latência.
- Se uma operação falhar, a Promise falha para o formulário fazer rollback **somente se sua atualização ainda for a atual**; operações seguintes continuam executando.
- A fila não coordena aparelhos diferentes e não elimina necessidade de regras e controle de concorrência no servidor.
- Não cria `getDocs`, listeners, consultas extras, migrations ou cron.

## Formulários financeiros
- Nova Despesa e Nova Compra mantêm uma trava sincrônica no próprio submit (além do `disabled` visual) para impedir dois submits antes do React renderizar. A trava solta no `finally` após falha; depois do sucesso ela permanece até a navegação, evitando uma segunda gravação na janela de transição.
- O `StockSupplyForm` já possuía sua própria trava; a página agora tem defesa adicional.
- Não altera estoque, saldo, estrutura de compra ou categoria.

## Diagnóstico da integração Site
- O estágio “Vinculado a rota” depende de rota existente com ID correspondente e ausência de cancelamento.
- A fase “Em rota” exige partida real (`started_at` ou `departure_time`). Apenas `route_id` não representa motoboy em trânsito.
- Cancelamento não é tratado como conclusão logística, mesmo com dados legados `completed=true`.
- O último estágio informa registro local; não promete confirmação remota de recebimento pelo Site.

## Segurança de release
- Instalação local somente. Não publicar Rule, flag, commit, push, deploy nem criar usuários.
- Exige TypeScript, PRE-APK com no mínimo 190 suítes, testes comportamentais e `git diff --check`.
- Firebase Emulator segue pendente de execução real.
