# DFL Entregas V111 R34 — Centro de Evidências da Equipe

## Objetivo
Consolidar as auditorias da R29/R32 (Prontidão) e R33 (integridade por UID)
sem liberar funcionários, publicar regras ou criar novas leituras automáticas.

## Novidades
- Nova tela premium `/mais/acessos/evidencias`, exclusiva do proprietário.
- Consulta manual de prontidão, seguida de comparação profunda de uma conta.
- Bloqueadores explícitos: dados desatualizados, amostra parcial, inconsistências,
  conta ativa, flags habilitadas, domínio de funcionário não confirmado.
- Lista de conferências humanas **apenas na memória da tela**; nunca é prova
  criptográfica, persistência, autorização de login ou autorização para deploy.
- Relatório copiável sem nome, e-mail, UID, telefone, endereço, valores ou tokens.
- Reuso de `StaffPremium`, `staffTouch` e `operational-toast` no mobile.
- Atalhos na Auditoria de Acessos e na Prontidão.

## Limites de segurança
- NÃO altera `staff_accounts`, `staff_workspaces`, deliveries ou estoque.
- NÃO cria API de ativação, nem muda Firestore Rules ou flags.
- O indicador de liberação é fixo em **BLOQUEADO**. Diagnóstico online não
  comprova as regras efetivas publicadas nem a experiência em outro aparelho.
- No máximo duas consultas explícitas por revisão: uma de Prontidão (R29)
  e uma por UID de integridade (R33). Cada uma respeita limites existentes.
- Atualizar a Prontidão invalida a auditoria profunda e a lista manual.
- Mudança de conta invalida respostas antigas para evitar mostrar dado trocado.
- A URL da API não recebe dados de cliente, e relatórios copiados não contêm UID.

## Validar
`node scripts/verify-v111-r34-release-evidence.cjs`
`node node_modules/typescript/bin/tsc --noEmit`
`node scripts/pre-apk.cjs`

A única instalação permitida é local (Termux). Sem push ou publicação automática.
