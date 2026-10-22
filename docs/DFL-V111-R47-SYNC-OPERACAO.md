# DFL Entregas V111 — R47

## Escopo
- Sincronização: merge por índice (O(n)), autoridade remota preservada, expansão de cards local preservada. Não há novas queries/assinaturas do Firestore.
- Diagnóstico: nenhuma tentativa pulada pode gerar toast de sucesso; visualização das coleções que mais retornaram documentos na última execução, **não equivale a custo de leituras faturadas**.
- Rotas: busca textual filtrada antes do cálculo de agrupamento e financeiro, mantendo contadores do dia completo.
- Caixa de Entrada: trava síncrona para importação contra toques simultâneos, antes do await de haptics.
- Equipe: o cenário owner-only continua em produção; Rules candidatas e Actions de Emulator não substituem execução de testes reais. Os quatro perfis só podem ser ativados após autorização explícita, testes de isolamento completos no Emulator, publicação controlada e monitoramento.

## Gates obrigatórios
1. TypeScript completo no Termux.
2. PRE-APK sem remover suítes anteriores.
3. Contratos R47 e testes comportamentais, rollback forçado e bloqueio por hash.
4. Firebase Emulator real **pendente**: executar a Action R44 e revisar logs antes de qualquer mudança de Rules.

Não executar commit, push, deploy, alteração de Rules/flags nem ativar contas nesta cirurgia.
