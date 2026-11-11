# DFL Entregas — P360 P3 | Central de Atualizações Android Premium

Data de referência: 11/11/2026. Projeto: `com.dfl.entregas`, Capacitor 6. Base auditada: `ae49f0b`.

## Objetivo

Versão **real** do APK via `App.getInfo().build` e número da Action (`GITHUB_RUN_NUMBER`). A versão web é independente. O PWA mantém as travas `mayApplyPwaUpdate` / `writeJournalSummary` existentes.

## Distribuição certificada

1. Action `.github/workflows/main.yml` valida TypeScript, contratos P360 e PRE-APK, gera export web, recria Android, aplica barras, Admin e ponte P360.
2. Preserva o keystore estável `DEBUG_KEYSTORE_BASE64` já em uso na versão instalada. **Não substitua o certificado** sem planejar migração; o sistema Android recusa atualização com assinatura divergente.
3. Definição do `versionCode` no Gradle: o inteiro real `GITHUB_RUN_NUMBER` (crescente no mesmo workflow), sem precisar de Gradle no Termux.
4. Após `assembleDebug` e validação `apksigner`, a Action mantém ZIP legado com retenção de 14 dias. Um job isolado com `contents:write` publica `DFL-Entregas-N.apk` e `.sha256` em GitHub Releases, tag `entregas-android-N`, commit do mesmo SHA. Não sobrescreve tag preexistente.
5. A Central consulta a API pública e só libera download integrado se encontra **Release publicada, não prerelease**, Action completa/aprovada da branch `main` com mesmo build e commit, URL exata da asset, digest SHA256 oficial e tamanho dentro dos limites. Sem digest ou Action confiável = sem botão de instalação integrada.
6. Plugin nativo constrói a URL de download internamente (ignora URLs do JavaScript), segue apenas redirects HTTPS em hosts permitidos, usa armazenamento privado e limite de 150 MB. Antes de instalar confere tamanho, SHA256, pacote, versão e certificado do APK instalado.
7. O usuário aprova a permissão de origem se exigida e confirma a atualização na interface oficial do Android; **sem instalação silenciosa**.
8. A primeira P3 precisará ser instalada manualmente via Release, pois o APK atualmente instalado não possui esse plugin. A partir da segunda P3 o download nativo pode ser usado.

## Experiência

- Home: banner discreto somente se a Release certificada for mais nova.
- Mais → Central de Atualizações: duas experiências separadas, PWA e APK.
- Android: versão instalada, latest certificada, progresso em MB e %, cancelamento, reabertura do instalador, erros honestos, Release alternativa e histórico editorial.
- Aviso Android de nova versão: opt-in por aparelho, uma vez por build, ao abrir/retomar, respeita silêncio/prioridade da P2 e não utiliza push remoto.
- Nenhuma modificação de Firestore, pagamentos, rotas, Site, Mensageria 360, Evolution ou NEXT_STOP.

## Gates

No Termux, só TypeScript, política hermética, P2 regression e PRE-APK (sem JDK/Gradle). Java e assinatura são validados no workflow depois de publish. A cirurgia **não faz commit, push nem deploy**. Não declarar produção nem instalação de APK confirmada com base apenas nos testes locais.

## Check pós-publicação (manual)

- Conferir Action completa `success`, inclusive o job `release-apk`.
- Conferir GitHub Release `entregas-android-N` do mesmo SHA, asset `.apk` e `.sha256`.
- Baixar e instalar **manualmente** o primeiro APK P3, garantindo manutenção de login e dados.
- Na atualização seguinte, verificar versão no Android, progresso, cancelamento, SHA/certificado, permissão de origem e confirmação do instalador.
- Testar offline, saída do aplicativo, reabertura, e PWA com gravação pendente.
