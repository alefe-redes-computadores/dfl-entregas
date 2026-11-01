# DFL ENTREGAS — R231 FECHAMENTO PREMIUM GLOBAL · CIRCUITO DE SEGURANÇA

Base exata: R230-R2 publicada. Nenhum dado é migrado e nenhuma regra do Firebase é modificada.

## Cirurgia real
- **PWA sem recarga destrutiva:** uma atualização do Service Worker não provoca `location.reload` enquanto houver operações pendentes/não verificadas no diário R230 ou formulário de compras em edição. Ao término da operação, novo evento local reavalia a recarga. Em operação não verificada, permanece bloqueada; nunca se presume confirmação remota. `SKIP_WAITING` e atualização do SW permanecem.
- **Compras com proteção de rascunho:** formulário em edição sinaliza seu estado ao runtime PWA; a proteção funciona durante gravação, falha e salvamento. Não impede edição offline nem altera lógica de compra.
- **Sincronização e retomada:** além do evento de rede, o banner R230 reavalia uma possível reconciliação ao voltar para o primeiro plano, exclusivamente com erro de sincronização ou operação não verificada, autenticação e hidratação válidas, e cooldown de 3 minutos. Não há polling, listener ou reenvio de transações.
- **Caixa de Entrada do Site:** filtro principal e histórico passam a usar `useDeferredValue` para aliviar digitação no Android; a projeção canônica, contadores e alocação transacional continuam intactos. Não altera a origem do pedido, a caixa nem as permissões.
- **Paradas físicas:** fixar/destravar parada agrupada mostra progresso por pedido e confirmação; gravação sequencial e tratamento de erros são mantidos.
- **Revisão de segurança:** testes novos e regressões antigas de baixa/desfazer, compras/estoque, Site e PWA; não é liberado nenhum novo acesso de staff, nenhuma regra ou configuração de produção.

## Limites de homologação
Não é prova de que todos os fluxos estejam perfeitos: ainda é necessário testar em dois aparelhos, incluindo Site→Caixa de Entrada→rota, baixa e desfazer por gesto, fixação multi-pedido, compra com teclado aberto, perda/retorno da rede, atualização do PWA durante edição e APK via GitHub Actions. A R231 é **candidata de fechamento**, não declaração automática de homologação física.

## Instalador
Base local e main remota verificadas; stage/working tree limpos; `git hash-object` dos arquivos-base; manifesto SHA256; backup; âncoras estritas; checagem sintática; teste próprio; testes de regressão críticos; `tsc --noEmit`; PRE-APK completo; allowlist exata; stage e commit seletivos; push apenas após aprovação; rollback em falha anterior ao commit. Não executa `git add -A` e não muda rules.
