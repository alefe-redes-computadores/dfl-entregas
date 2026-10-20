# DFL Entregas V111 R26 — Gate de seguranca do Firestore

## O que foi feito
- Regras candidatas *somente em arquivo* `security/firestore.v111-r26-candidate.rules`.
- Testes de acesso permitido/negado com `@firebase/rules-unit-testing`, Firebase Firestore emulator `127.0.0.1:8087`, projeto `demo-dfl-entregas-r26`.
- Action MANUAL `.github/workflows/firestore-r26-homologation.yml` (`workflow_dispatch`); nao executa por push e nao chama `firebase deploy`.
- Gate estatico local no PRE-APK para detectar mudancas abertas no arquivo candidato ou na Action.

## Como validar depois de publicar codigo (nao fazer antes)
1. Confirmar que R21–R26 entraram em commit seletivo, mantendo o backup `RouteAccordion.tsx.orig` fora.
2. Abrir **GitHub Actions > DFL R26 - Auditoria Firestore isolada > Run workflow**.
3. Confirmar o job Firestore Emulator VERDE e verificar o numero de cenarios impressos no log.
4. Testar as APIs admin, os dados projetados e os dominios separados; revisar logs e regras candidatas. A verificacao emulada nao substitui homologacao em dispositivos.
5. **NAO publicar regras no Firebase Console nem ativar funcionario** apenas porque o emulador passou.

## Limites atuais
- A producao segue exclusivamente ao UID do superadministrador; NENHUMA conta de funcionario tem acesso real.
- Projecoes de staff sao preparadas sob demanda e podem ficar desatualizadas; sincronizacao de rotas e estoque em tempo real ainda nao existe.
- Motoboy NAO pode cadastrar ou finalizar entrega, e Compras NAO pode movimentar estoque: APIs seguras de mutacao ainda nao implementadas.
- Revogacao impede novas leituras ao servidor, mas nao apaga fotos, dados copiados ou exportados por alguem.
- Uma conta com acesso autorizado poderia visualizar apenas sua projeção, ainda assim dados indevidos jamais devem ser copiados para os documentos projetados.
- Não reutilizar a mesma origem web/IndexedDB entre owner e funcionário. APK staff continua bloqueado.

## Segurança da automação
- A Action funciona apenas com um `demo-` project e sem variaveis reais de Firebase.
- A execucao no Termux NAO roda Firebase Emulator, NAO publica rules, NAO faz commit/push/deploy.
- O emulador so roda apos publicacao autorizada do codigo e disparo manual da Action.
