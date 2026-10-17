# DFL Entregas — V101 | Fechamento para publicação

Esta entrega **não altera rotas, estoque, pagamento ou acerto**: estabiliza o pipeline Android e evita publicar um commit incompleto.

## Implementado
- Workflow com permissões mínimas `contents: read`, concorrência por branch, timeout e retenção do APK por 14 dias.
- Gate local de release com inventário Git, seleção de arquivos novos relevantes, verificação de nomes sensíveis, validação da ordem de patches Android e lista de staging para revisão manual.
- Verificador V101 integrado ao PRE-APK.
- Instalador retomável que confere a V100.6 exata, salva backup e valida TypeScript, PRE-APK e Git.

## Publicação — ordem segura
1. Rodar `node scripts/release-v101.cjs --report` depois que o instalador validar.
2. Ler `~/storage/downloads/dfl-v101-release-candidatos.txt`; investigar caminhos ignorados e arquivos gerados por cirurgias anteriores que ainda estejam untracked.
3. Antes de `git add`, revisar `git diff --stat`, `git diff --check`, `git status --short` e possíveis segredos. O manifesto `.nul` é **apenas sugestão**; não executar cegamente.
4. Verificar a regra real do Firestore no Console. A última regra relatada permitia `read, write: if true`, o que **não é seguro**. Não criar regras novas sem mapear coleções/autenticação e integração com o DFL Site, que é um projeto separado.
5. Validar os Secrets do GitHub Actions (Firebase, Geoapify e `DEBUG_KEYSTORE_BASE64`), sem copiar valores para o chat.
6. Conferir estabilidade do mesmo certificado Android existente (evitar nova assinatura e bloqueio de atualização).
7. Só após aprovação explícita, fazer staging seletivo, commit e push. O push em `main` dispara build APK. Acompanhar Actions, baixar o artefato, instalar e fazer smoke test no Android.
8. Smoke test: localização nativa/permissões, definir origem da Loja, organizar rota, pedidos do Site (retirada só Site), cancelar no Site, entregar iFood/código, contato, mensagens e cartão, Pix/cobrança, estoque/contagem/compras e acerto.

## Limites
- PRE-APK não comprova comportamento visual real nem segurança das Rules publicadas.
- V101 não acessa banco, não altera regras, não faz deploy, nem executa commit/push.
- DFL Site e DFL Entregas devem ser verificados separadamente antes do rollout geral.
