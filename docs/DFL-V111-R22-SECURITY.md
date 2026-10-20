# DFL V111 R22 — Divisao segura do runtime e candidatura de regras

## Entregas desta fase
- `StaffPortal`: interface isolada, montada somente para UID nao-admin quando a flag de build `NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED=true` e deliberadamente habilitada.
- `staff_accounts/{uid}`: conta autenticada por UID Firebase, consultada via Firestore, fonte autoritativa de status e permissoes (nao email nem rascunho).
- `staff_workspaces/{uid}/{section}/{id}`: visao segregada; `StaffPortal` so le documento da propria conta e `getDocsFromServer` de area autorizada, limit 40, sem leitura das colecoes raiz.
- Visual de estado `suspenso`, sem acesso, sem permissao; revogacao limpa a lista e desmonta a interface.
- `Mais > Equipe e permissoes > Auditoria`: contabiliza RASCUNHOS e rotas atribuidas, sem escrever ou ativar contas.
- Politica candidata `security/firestore.v111-r22-staff-staged.rules` (NUNCA publicada pelo instalador).
- API legada segue restrita a UID do superadmin em R21. Novo portal nao tem acesso a esses endpoints.

## Isto ainda NAO ativa os funcionarios
**Nao mudar a regra atual do Console**. Nao habilitar a flag na Vercel ou GitHub Actions.
Mesmo se alguem fizer login Google, recebe "Acesso nao liberado" ate que AMBAS: politica testada e flag habilitada. Com a regra atual, leituras de funcionario recebem permission-denied.

## Ativacao (proximas fases)
1. Gerar projeções MINIMAS, por UID, sem custos, financeiro, dados de outra pessoa;
   projeto atual tem colecoes globais e nao se deve expor o payload bruto.
2. Endpoint administrativo autenticado via Firebase Admin + UID fixo, nao confiar em email;
   vincular UID confirmado e exigir segunda confirmacao antes de criar `staff_accounts/{uid}` status active.
3. Regras no Firestore Emulator com testes reais: read own profile, deny other profile,
   deny global root, deny cross-UID, suspend revocation, deny staff write, area limited,
   query sem limite, account missing, owner read/write preserved.
4. Testar que backend Admin SDK ignora Rules; auditar todos endpoints antes da primeira ativacao.
5. Isolar cache offline por UID; limpar estado legado se sair da conta admin.
6. Publicar politica revisada e validar APK/PWA com conta de HOMOLOGACAO,
   nao equipe em producao. Implementar escrita autorizada por servidor por operacao.
7. Depois liberar a flag no PWA e no build do APK, SEM confundir com aplicar regras.

## Limites intencionais
- Projecoes de R22 apenas contratadas, nao sao produzidas automaticamente.
- Nenhuma criacao/edicao/finalizacao de rota, entrega ou compra por funcionario ainda.
- Nao usar `allow read: if request.auth != null`.
- Testes R22 sao de estrutura/contratos; testes comportamentais no Emulator faltam.
- Rules nao mascaram campos dentro de documentos. Nunca expor `routes`, `deliveries`, `customers`, `stock_movements`, `settlements` raiz a funcionarios.
