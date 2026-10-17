# V100.5 — Localização operacional e preparação do APK

## Falha observada

No aplicativo instalado, usar a localização da Loja exibia erro de permissão e o Android não listava Localização nas permissões do aplicativo.

## Causa técnica provável

A Action recria `android/` com `npx cap add android` e `npx cap sync android` em toda compilação. Nenhum passo do workflow garantia explicitamente as declarações `ACCESS_COARSE_LOCATION` e `ACCESS_FINE_LOCATION` no AndroidManifest.xml. O código web tinha tratamento de erro, mas não poderia corrigir uma permissão ausente no APK.

## Correções

- `scripts/patch-android-location-permissions.mjs`: patch idempotente do Manifest **depois** de `cap sync` e **antes** de Gradle, com permissão de GPS e localização aproximada e hardware GPS opcional.
- `lib/device-location.ts`: usa o plugin nativo quando `Capacitor.isNativePlatform()` e pede permissão no toque do usuário. No navegador, usa Geolocation API com orientação para o usuário liberar a permissão do site. Sem queda silenciosa do plugin nativo para WebView.
- `components/location/LocationPermissionGuide.tsx`: orientação curta e acionável para APK e PWA.
- Loja: status visível, permite tentar novamente, aceita coordenadas exatas e alerta quando a origem é somente uma cidade.
- Organizador: utiliza origem salva válida, não faz geocodificação do centro da cidade por falta de endereço e identifica GPS provisório quando for usado.
- Store: não reorganiza rotas a partir de latitude e longitude inválidas (0,0).
- Header: safe-area do APK não deixa conteúdo sob a barra de status.

## Testes necessários DEPOIS do push e de gerar o novo APK

1. Instalar o novo APK **com a mesma assinatura**, abrir Loja > Origem e tocar em **Usar GPS e salvar origem da loja**.
2. Confirmar que o Android pergunta pela localização (caso ainda não tenha sido concedida), com opção de localização precisa.
3. Abrir Configurações Android > Apps > DFL Entregas > Permissões e verificar que **Localização** agora aparece.
4. Aceitar e salvar; sair e voltar à Loja; conferir se a origem precisa persistiu.
5. Negar e tentar novamente; conferir a instrução contextual. Se bloqueada, liberar manualmente nas configurações.
6. Organizar rota com origem salva; testar paradas sem coordenadas e impedir que somente `Patos de Minas, MG` seja tratado como posição da loja.
7. Testar PWA em HTTPS e permissões de site, sem supor que o navegador permita reabrir automaticamente um prompt já bloqueado.
8. Checar o topo das telas, toasts e notch no Android, com prints reais.

## Segurança / publicação

- Não há novo acesso ao Firebase, alteração de esquema, migração ou listener.
- A alteração do Manifest só tem efeito **depois de novo APK**. A versão instalada atualmente pode continuar com o problema.
- A publicação exige revisão explícita das regras do Firestore; permissões abertas (`allow read, write: if true`) não são aceitáveis em produção.
- Antes de qualquer commit, rever todos os arquivos modificados e os novos arquivos preservados desde V87. **Não executar `git add .`.**
