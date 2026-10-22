# DFL ENTREGAS V111 R58 — PERFORMANCE RELATÓRIOS E HOME

## Abrangência real

- **Relatórios, rotas fechadas:** calcula a quantidade de entregas por rota em uma única passagem pelo conjunto selecionado; preserva multiplicidade, ordem dos resultados, lista de rotas e durações confiáveis. Sem leituras Firestore adicionais.
- **Relatórios, período inteiro:** identifica a primeira data conhecida em uma passagem sem ordenar o histórico completo. Pedidos sem data continuam preservados nas métricas que não dependem de data.
- **Relatórios, janelas temporais:** converte limites para chaves de São Paulo uma vez por janela, não a cada entrega. Mesmas regras para período atual e anterior.
- **Home:** reutiliza timestamps das rotas e o recorte de pedidos do dia já calculados, inclusive quando filtra entregador. Não deduplica IDs legados nem altera a ordem de desempate.
- **Resiliência temporal:** conversões toDate() inválidas ou que geram exceção não derrubam a tela; o dado fica sem timestamp até ser corrigido na origem.

## Garantias e limites

- Sem alteração de números, saldos, estoque, confirmação iFood, Rules ou flags.
- Sem novas consultas, listeners, polling, scripts periódicos ou mudanças no banco.
- A R58 *não* habilita funcionários. A homologação via Firebase Emulator permanece pendente; preparar Actions não significa executá-las.
- PRE-APK R57 com 196 suítes, R58 com 198; suites anteriores não foram removidas.
- A execução na cópia de desenvolvimento não substitui TypeScript completo e PRE-APK no Termux.
- Nenhum commit, push ou deploy é executado pelo instalador.

## Validação

- `node scripts/verify-v111-r58-operational-performance.cjs`
- `node scripts/test-v111-r58-operational-performance.cjs`
- `node node_modules/typescript/bin/tsc --noEmit`
- `node scripts/pre-apk.cjs`
- `git diff --check`
