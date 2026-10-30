# DFL Entregas — R205: Plano de publicação seletiva

## O que esta ferramenta faz
Gera inventário de arquivos modificados e não rastreados, classifica os itens e calcula SHA-256 para cada candidato. Não altera o index Git, não faz commit, push, deploy, alteração de regras, sincronização ou escrita em Firestore.

## Classificação conservadora
- `CODIGO_CANDIDATO`, `DOCUMENTACAO_CANDIDATA`: entram apenas numa **sugestão de allowlist**, sujeita a revisão humana e publicação futura explicitamente autorizada.
- `REGRAS_REVISAO_SEPARADA`, `CONFIG_REVISAO_SEPARADA`: nunca entram na allowlist automática. Workflows, package.json, lockfile, firebase.json e arquivos de configuração requerem avaliação adicional.
- `SEGREDO_NAO_PUBLICAR`, `SOBRA_NAO_PUBLICAR`, `GERADO_NAO_PUBLICAR`: não entram na allowlist.
- Exclusões (`git diff --diff-filter=D`) são registradas e precisam de avaliação separada.

A auditoria não assume que qualquer configuração Firestore local está efetivamente publicada. Nenhum arquivo R24/R26 deve ser publicado sem homologação e autorização explícita.

## Evidências
O instalador produz em `~/storage/downloads/dfl-entregas-backups/R205-*`:
- `R205-RESULTADO.txt`: inventário e status;
- `R205-ALLOWLIST.txt`: candidatos à revisão (não executar cegamente);
- `R205-PENDENCIAS.txt`: exclusões e testes pendentes;
- `R205-MANIFEST.json`: HEAD, branch e hashes para detecção de divergência;
- `execucao.log`: execução integral.

Para rever a integridade do manifesto **sem alterar o repositório**:

```bash
cd ~/projects/dfl-entregas
node scripts/r205-verify-manifest.cjs --manifest "$HOME/storage/downloads/dfl-entregas-backups/R205-.../R205-MANIFEST.json"
```

Se o conteúdo, status de Git, HEAD ou branch mudarem, a verificação bloqueia. Será necessário gerar novo inventário. O SHA-256 não constitui assinatura de aprovação nem prova remota.

## Pendências para produção
1. Consultar e comparar de modo autenticado a versão das regras **implantadas** no projeto correto. Arquivo local não basta.
2. Homologar build do Android GitHub Actions, instalação, autenticação Google, offline, notificações, rotas, dinheiro e permissão de tela.
3. Fazer teste controlado de concorrência em **dois aparelhos**, especialmente importação e sincronização.
4. Revisar integralmente a allowlist e os diffs, com atenção a sobras `.orig` e segredos.
5. Obter aprovação explícita do proprietário antes de preparar commit, push ou qualquer publicação.

**Nunca** utilizar `git add -A` para publicar esse release.
