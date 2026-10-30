# DFL ENTREGAS — R206 | Revisão do release (sem publicação)

## O que esta cirurgia realiza

- Recria o manifesto R205 **depois** da aplicação da R206. O manifesto anterior fica obsoleto pela mudança prevista no código e pelo novo teste pré-APK.
- Compara com o manifesto R205 anterior (quando presente) e registra os arquivos novos, removidos da seleção ou com hash diferente.
- Simula `git add` **apenas em um índice descartável (`GIT_INDEX_FILE`)**, sem tocar no índice real; exige coincidência exata de caminhos e verifica `git diff --cached --check` no índice simulado.
- Mantém fora da simulação os arquivos classificados como `REGRAS_REVISAO_SEPARADA`, `CONFIG_REVISAO_SEPARADA`, `SEGREDO_NAO_PUBLICAR`, `SOBRA_NAO_PUBLICAR` etc.
- Preserva o status **PENDENTE_HOMOLOGACAO_REAL** ainda que o gate automatizado fique verde.
- Executa TypeScript, todas as suítes pre-APK, contratos R205/R206, pré-verificação e rollback seletivo sem commit, push, deploy, Firebase ou APK.

## Cuidado operacional

Uma simulação bem-sucedida mostra que os caminhos da allowlist podem ser preparados **sem alterar o Git real**. Não atesta segurança da lógica nem autoriza a publicação. Cada um dos candidatos selecionados deve ser revisado, inclusive possíveis mudanças em regras de negócio dentro de `app/` e `lib/`.

O teste real de dois aparelhos, prova autenticada das regras Firestore publicadas, homologação APK e autorização expressa do dono continuam pendentes.

## Evidências

`R206-RESULTADO.txt`, `R206-RESULTADO.json`, `R206-STAGE-SIMULADO.txt`, `R206-DELTA-R205.txt`, `R206-CHECKLIST.txt`, `R205-MANIFEST.json` atualizado (em `baseline/`) e `execucao.log`.
