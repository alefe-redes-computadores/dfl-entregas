# DFL Entregas — R229: performance operacional / circuito 1

Base obrigatória: main publicada `a52ebcd55b920a27be56a01f2086f945050a162e` (R228-R4 aprovada). O pacote não reaplica R228; depende dela e falha se detectar alterações locais.

## Escopo desta cirurgia

1. **Ordem de rota enxuta**: ao mover uma parada, só as entregas cujo `order_index` mudou serão efetivamente persistidas no batch. Rota com 80 pedidos, trocando duas posições vizinhas, passa de até 80 updates para 2 quando o índice prévio está normalizado; travas explícitas continuam respeitadas.
2. **Proteção transacional preservada**: fila por rota, autoridade dos índices, ordenação de paradas físicas, lock de documentos, rollback granular e gate de 500 documentos permanecem. O `queueDeliveryDocuments` continua bloqueando os mesmos IDs para não permitir que baixas concorrentes ultrapassem a alteração de ordem.
3. **Animação FLIP da lista**: `useLayoutEffect` calcula posições anteriores por identidade de parada e anima apenas itens realmente reordenados. Respeita `prefers-reduced-motion`; não depende de biblioteca adicional nem modifica lógica do swipe.
4. **Feedback honesto**: status de reordenação local versus confirmação do servidor. Não habilita setas enquanto um batch dessa parada está pendente, evitando gravações cruzadas, mas apresenta claramente o que está ocorrendo.
5. **Compra de estoque**: feedback após 1,4 s de espera remota, preservando rascunho e exigência de confirmação do servidor. Não representa saldo pendente como efetivado.
6. **Nova entrega**: feedback após 1,4 s de espera; deduplicação do submit e telemetria do cliente/pedido permanecem.
7. **Diagnóstico operacional**: adiciona métrica local sem dados pessoais para a confirmação do batch enxuto de rota (P90 disponível em Mais → Diagnóstico).

## Fora deste circuito, ainda na sequência prevista

- **R230 (offline-first real)**: fila durável de mutações, replays idempotentes, reconciliação de conflitos entre APK e PWA, autoridade Firestore para estoques/finanças. Isso NÃO deve ser implementado removendo `await` de transações críticas; exige testes offline, retomada após fechamento forçado e rede intermitente.
- **R231 (polimento transversal)**: medir em dois aparelhos/rotas reais, revisar baixa, confirmação de pagamento, cards compactos, cadastros, leituras Firestore, integração Site→Inbox, 99Food, regras e notificações antes de marcar fim do roadmap.

## Instalação e segurança

Base local e origin/main rigorosamente verificados, sem stage pendente, SHA256 do payload, backup seletivo para `~/storage/downloads/dfl-entregas-backups`, patch com âncoras exatas, regressão dedicada, R94 concorrência, R228, `tsc --noEmit`, PRE-APK completo, `git diff --check`, allowlist e publicação seletiva apenas quando tudo aprovar. Rollback antes do commit; nunca force push ou reset automático de commit local.

As metas de 100–200 ms são alvos de percepção visual, não medições já comprovadas; o tempo do servidor ainda pode variar. Nenhuma alteração direta nas Rules/Firestore, sem deploy de regras.


## R229-R2 — Resgate da validação

A tentativa R229 anterior fez rollback antes da publicação. Falhou no teste novo,
que usava `store.indexOf('toggleDeliveryExpansion:')` como fim de recorte; a
primeira ocorrência está na interface de tipos do Zustand, **antes** da ação
`setDeliveryOrder`. O teste inspecionava uma string vazia, apesar de o patch
ter aplicado o import e o diff corretamente. A R229-R2 agora ancora o início e
o fim das implementações reais, valida a ordem dos índices e mantém todas as
verificações originais. Nenhuma suíte foi removida ou desativada.

O código de negócio da R229 permanece intocado neste resgate. Os testes
TypeScript completo e PRE-APK integral seguem obrigatórios antes do push.


## R229-R3 — Resgate das duas regressões e desfazer por arrasto

- R228 `test-r228-operation-polish.cjs`: mantém o prefixo histórico **Movendo parada…** no feedback, junto da explicação de confirmação remota.
- V100.2 `verify-v100-2-purchases-integrity.cjs`: a trava síncrona de envio é liberada como primeira ação do `finally` mesmo com a limpeza dos indicadores de espera. A compra continua só navegando após sucesso remoto.
- Gesto móvel: ao arrastar para a esquerda, o cartão pendente dá baixa e o concluído permite desfazer pelo **mesmo handler transacional** dos botões. Arrastar à direita expande. Deslocamento curto/diagonal não executa ação.
- V103, V111-R14 e V112-R90: contratos legados atualizados para verificar o comportamento solicitado em vez de proibir desfazer por swipe; nenhuma suíte foi removida.
- Novo contrato comportamental `test-r229-r3-swipe-undo.cjs` testa baixa, desfazer, paradas agrupadas, contagens inválidas, rota fechada, botões e acessibilidade.
- O script executa explicitamente as duas suítes que reprovaram a R229-R2 **antes** do TypeScript e do PRE-APK completo.

Esta cirurgia **não** muda o status financeiro de uma entrega nem o método de pagamento durante o gesto; usa a função já existente de baixa/desfazer.
