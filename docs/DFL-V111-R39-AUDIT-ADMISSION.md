# DFL V111 R39 — Escudo de admissão de auditorias

Base R38 aprovada, PRE-APK 157/157. Não altera flags nem Rules.

## Mudança
- Prontidão e Integridade só adquirem permissão de leitura após validar token revogado e UID owner.
- Limite em memória: até uma auditoria de cada tipo por instância Node, dois escopos no total.
- Janela de 6 segundos por tipo. Requisições simultâneas/repetidas recebem HTTP 429 com Retry-After, **zero novas consultas Firestore**.
- Em sucesso, erro ou exceção, o slot é devolvido por `finally`.
- Nenhum UID ou dado pessoal armazenado no controle; apenas os escopos e timestamps de processo.
- O limite é **por instância**, não global à Vercel: múltiplas instâncias podem executar auditorias simultâneas. Não alegar economia exata de leituras cobradas.
- READINESS conserva `30+1` contas, `100+1` solicitações e no máximo 150 projeções limitadas a uma linha, em quatro workers.
- Integridade mantém os limites anteriores e sem writes.
- A tela de orçamento usa denominadores individuais (31, 101, 150) e distingue ausência/truncamento.

## Decisões independentes
1. Execução técnica local (TypeScript e PRE-APK).
2. Validação manual de Rules e Emulator em projeto demo.
3. Autorização expressa do proprietário para publicar.
4. Autorização expressa e independente para qualquer ativação de funcionário.

Nenhuma dessas decisões é tomada automaticamente pela R39.

## Validação
`node scripts/verify-v111-r39-audit-admission.cjs` e `node scripts/test-v111-r39-audit-admission-api.cjs`, `node scripts/pre-apk.cjs`. Emulador real só se a Action manual for executada depois de publicação autorizada.
