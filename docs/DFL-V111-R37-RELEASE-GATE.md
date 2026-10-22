# DFL Entregas V111 — R37 | Gate técnico / liberação SEM ativação

Base remota verificada em 2026-10-21: `4a469b8f905e64261b252d9f867d1c56a3570239`. R27–R36 ainda locais e não enviados. R37 deve ser aplicada sobre o snapshot R36, validando SHA256 antes de tocar nos arquivos existentes.

## Três decisões independentes

1. **Preparação técnica**: PRE-APK, TypeScript, inventário e revisão do diff local.
2. **Publicação**: autorização explícita, commit seletivo e execução real das Actions. Este ZIP não publica.
3. **Ativação staff**: processo separado; Rules atuais de produção OWNER-ONLY, quatro flags DESLIGADAS, equipe suspensa. Nenhuma aprovação de testes substitui a autorização do proprietário.

## Limites e recursos

- Consultas de Prontidão: até 31 documentos de conta e 101 solicitações no teto de truncamento; até 30 × 5 subconsultas pontuais de projeções, cada uma com `limit(1)`; todas sob demanda.
- Integridade: limite definido em `INTEGRITY_SAMPLE_LIMIT` por área + `INTEGRITY_SOURCE_READ_BUDGET`; documento de conta e fontes por ID com cache de promessas.
- Refresh: prévia por UID e transação com revalidação de conta, rascunho, fontes e projeções; no-op sem gravar.
- No gate R37: **zero novas leituras** sem clicar em consultar; nenhuma assinatura, timer ou polling; relatórios sem dados privados.
- Auditoria estática por regex indica indícios, **não mede Firestore real**. Custo de documento inexistente, tentativas transacionais, regras e índices devem ser medidos depois.

## Homologação do Firebase Emulator

A Action `.github/workflows/dfl-r37-release-gate.yml` é **manual** (`workflow_dispatch`), somente leitura de Git, projeto `demo-dfl-entregas-r36`. Usa `firebase.r36-emulator.json`, `security/firestore.v111-r26-candidate.rules` e testes do commit transacional R36.

**Pendente:** log verde real do Firebase Emulator; o relatório R36 cita PRE-APK 154 suítes, mas não confirma o Emulator. Não chamar de APROVADO até ver o log com SHA, Action, teste e ausência de regressão.

## Publicação futura (NÃO executar automaticamente)

- Comparar HEAD local/remoto, inventariar alterações rastreadas e untracked, confirmar chaves e variáveis excluídas.
- Conferir review do diff e todos os PRE-APK (>=155 após R37).
- Revisar Firestore Rules LIVE OWNER-ONLY e isolamento de apps/staff; nenhuma alteração de Rules agora.
- Após autorização: commit seletivo R27–R37, push, Action R37 manual e verificação externa separada.
- Verificar status de deploy da Vercel antes de habilitar qualquer fluxo; conexão Vercel retornou 403 ao ler escopo em 2026-10-21, **não constitui evidência**.
- Nunca publicar as Rules candidatas automaticamente, nem criar contas ativas.

## Frentes posteriores

Estoque/Compras, Rotas, Site/iFood, SAC, deduplicação de clientes e performance operacional permanecem candidatos a auditorias próprias; R37 não declara a correção dessas áreas.
