# R203 — Firestore publicado, evidências e concorrência

Escopo seletivo: `scripts/pre-apk.cjs` (registro de teste) + 4 scripts de auditoria e teste + este documento. Não toca em `store/`, regras, dados ou Firebase. Nenhuma publicação automática.

## 1. Auditoria local (automática)

A instalação executa a auditoria offline e produz `R203-REGRAS-LOCAIS.json` no backup. Isso **não** comprova o que está publicado. R21/R23 são espelhos owner-only. R24/R26 são candidatas de emulador e não podem ser publicadas automaticamente.

## 2. Atestação da regra realmente publicada (opcional e somente GET)

Use uma identidade Google com permissão de **leitura** de regras (`firebaserules.releases.get` e `firebaserules.rulesets.get`) e um projeto **explícito**, conferido no Firebase Console. A rotina não usa o Firebase Admin, não consulta coleções e não faz deploy.

```sh
cd ~/projects/dfl-entregas
# Digite o ID do seu projeto real conferido no console:
export DFL_R203_PROJECT_ID='ID_REAL_DO_PROJETO'
# Se gcloud estiver instalado/autenticado, a rotina obtém token temporário:
node scripts/r203-firestore-attest.cjs --remote --out "$HOME/storage/downloads/R203-RULES-PUBLICADAS.json"
```

Alternativamente, credencial OAuth de curta duração somente pela variável `DFL_R203_ACCESS_TOKEN` em sua sessão privada. **Não escreva tokens nos relatórios nem os envie no chat**. Remova-os após usar: `unset DFL_R203_ACCESS_TOKEN`.

Um `OWNER_ONLY_VERIFICADO` exige consulta REST efetiva + correspondência normalizada ao espelho owner-only. Um retorno `PENDENTE` não libera produção. A rotina registra apenas hashes e identificador de ruleset, nunca texto das regras ou tokens. Correspondência técnica não dispensa homologação de perfis, indexação e aprovação explícita.

## 3. Prova da corrida entre dois aparelhos — Firestore Emulator

A simulação de concorrência real exige Firebase Emulator, Node deps instaladas e host loopback. **Nunca usa seu banco de produção.** A R203 NÃO inicia Emulator automaticamente no celular, pois é pesado. Em ambiente com Firebase CLI:

```sh
cd ~/projects/dfl-entregas
# Somente com Firebase CLI já instalada; confirme antes o projeto demo.
unset FIREBASE_PROJECT_ID NEXT_PUBLIC_FIREBASE_PROJECT_ID GOOGLE_APPLICATION_CREDENTIALS DFL_R203_ACCESS_TOKEN
firebase emulators:exec --project demo-dfl-entregas-r26 \
  --config firebase.r26-emulator.json --only firestore \
  'node scripts/r203-emulator-import-race.cjs'
```

O teste exige `FIRESTORE_EMULATOR_HOST=127.0.0.1:8087`, `GCLOUD_PROJECT=demo-dfl-entregas-r26` e recusa variáveis de produção. Confere duas sessões concorrentes, um sucesso, uma recusa, ausência de sobrescrita e IDs distintos por plataforma/dia. Não substitui testes manuais da UI PWA/APK, nem detecta legados com ID aleatório.

## 4. Homologação humana obrigatória

1. Conferir no Console a identidade do projeto e comparar o hash do ruleset em produção com o relatório R203.
2. No Emulator, testar proprietário, funcionário ativo, suspenso, compras e motoboy com leitura indevida negada. Não publicar candidatas R24/R26 sem autorização.
3. Em dois aparelhos de teste, sincronizar Caixa, importar um pedido de plataforma de teste com o mesmo ID e verificar que só um registro é criado. Evitar gerar pedidos reais de clientes como experimento.
4. Conferir visualmente Caixa, edição, entregas, rotas, cancelamento, 99Food e fallback offline no APK e PWA.
5. Conferir o radar R202 contra legados; nenhum documento deve ser removido automaticamente.
6. Validar build e assinatura APK no GitHub Actions com commit autorizado, somente após o gate.

**Gate de produção continua PENDENTE** até regra publicada verificada, testes de perfis, APK em aparelho e aprovação explícita. Não usar `git add -A` nem `firebase deploy` automaticamente.
