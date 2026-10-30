# DFL ENTREGAS — R204 / HOMOLOGAÇÃO E GATE DE PRODUÇÃO

## Escopo

- Nova página somente-leitura: `Mais > Equipe e permissões > Homologação da produção`.
- Checklist de testes no APK, Android, Site, 99Food, iFood, perfis e concorrência.
- Marcadores do checklist **apenas nesta sessão**, sem persistência, sem ativar permissão.
- Comando de auditoria de evidência de Rules R203 existente; não realiza consultas remotas nem publica regras.
- Novos contratos registrados no `scripts/pre-apk.cjs`.

## O que esta versão NÃO comprova

- Execução do `pre-apk` não comprova se as regras de Firestore estão publicadas.
- Arquivos `.rules` locais e arquivos JSON exportados não são provas independentes do servidor.
- Marcar um checklist não muda o estado das regras, nem concede direitos, nem certifica uma instalação.
- Não foi feito teste com dois aparelhos reais nem teste do APK de produção por este pacote.

## Instalação

`bash ~/storage/downloads/DFL-R204-GATE-PRODUCAO/instalar.sh`

Instalador não faz commit nem push, não altera dados Firestore e bloqueia o stage preexistente. Gera backup em Downloads e restaura apenas os dois arquivos tocados + remove os cinco novos se uma etapa falhar.

## Comprovação de regras do projeto certo — passo posterior, opcional

Somente depois de obter acesso autorizado ao Firebase Rules, no Termux:

```bash
cd ~/projects/dfl-entregas || exit 1
# Consulta autenticada e SOMENTE GET, projeto de produção explícito:
# node scripts/r203-firestore-attest.cjs --remote --project PROJETO_EXATO --out "$HOME/storage/downloads/r203-atestacao.json"
# Não cole tokens OAuth ou arquivo de credenciais na conversa.
# O relatório R204 apenas interpreta evidência R203 declarada, sem consultá-la diretamente:
# node scripts/r204-release-evidence.cjs --project PROJETO_EXATO --rules-evidence "$HOME/storage/downloads/r203-atestacao.json" --out "$HOME/storage/downloads/r204-evidencia.json"
```

**Importante**: R203 compara uma regra publicada com um arquivo de referência; a semelhança de texto não é prova formal de segurança. Conferir permissões, claims, projetos, usuários e testes no emulator antes de publicar.

## Homologação manual

1. APK assinado instalado e login Google em aparelho real.
2. Owner vê todas as telas autorizadas; funcionário não vê telas bloqueadas e não lê dados de outras pessoas.
3. Site → Caixa: pedido sem rota até a aprovação e o vínculo transacional.
4. 99Food / iFood: números iguais em canais distintos não conflitam.
5. Dois aparelhos ao mesmo tempo: só uma importação nova de identidade forte pode vencer.
6. Offline/online: dados e edição conciliados sem duplicidade.
7. Retornos, dinheiro da rota e acerto do motoboy conferidos.
8. Regras realmente publicadas lidas da API oficial e comparadas ao projeto esperado.
9. Autorização explícita para publicar; **nenhum arquivo `.orig`, `.bak`, segredo ou candidato de emulador no release**.
