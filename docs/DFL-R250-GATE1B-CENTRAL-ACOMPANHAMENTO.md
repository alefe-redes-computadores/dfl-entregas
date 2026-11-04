# DFL Entregas R250 — Gate 1B · Central operacional interna de acompanhamento

Base obrigatória: R249 `0dc4385e403f7bcedbcf9fd237e78be6955754ef`. Acompanhar apenas internamente, SEM acesso público e SEM mensagens reais. O Finance, Site, DFL Assist, Combo V3, Firebase Rules, VPS e checkout não são alterados.

## O que está implementado

1. `Mais → Central de Acompanhamento` (visível apenas ao UID superadministrador). Seleção rápida por pedido, com busca/filtros Site, Loja/manual, iFood e 99Food, até 80 resultados do cache local, sem leituras por card.
2. Atalho no detalhe de entrega para a Central, exclusivo do superadministrador.
3. Compatibilidade PWA/APK com preflight CORS somente para `https://localhost`, `http://localhost` e `capacitor://localhost` nas APIs administrativas de inspeção, confirmação e sincronização; nenhuma origem arbitrária e sem cookies CORS.
4. Inspeção administrativa GET por **uma** entrega: verificação do token Firebase revogado, vínculo estrito com tenant, leitura confirmada da entrega/rota no servidor e no máximo 60 eventos persistidos da ledger R249.
5. Modelo de evidências de aceite, alocação, despacho, conclusão, dados faltantes, reconciliação e mercado inelegível. Distingue estado operacional local (indicativo) de projeção construída com fatos confirmados.
6. Prévia pública allowlist estrita via `projectPublicTracking`, somente quando há eventos persistidos; `progress` não é inventado. Botão copiar JSON do contrato, sem telefone, endereço ou pagamento.
7. Diagnóstico de modo, kill-switch, ausência de tenant, falta de aceite e falta de evento. Novos links, mensagens, VPS e tracking público continuam OFF.
8. Controles de `Confirmar pedido manual` e `Reconferir eventos` disponíveis **somente** no ambiente DRY_RUN explicitamente configurado. Exigem nova confirmação humana; delegam à API Gate1 R249, nunca forjam aceite local.
9. A página pode existir em PWA/APK sem habilitar recurso ao cliente. A API de inspeção é exclusivamente admin e não emite links ou grava estados.

## Fronteira de segurança

- `GET /api/integration/tracking/v1/admin/inspect?delivery_id=<id>` — privado, Bearer Firebase Owner UID com verificação de revogação, sem cache e sem CORS público. `403` sem autenticação, `422` ID ou query incorretos, `404` tenant não configurado/pedido indisponível, `503` erro do servidor. Nunca devolve segredos, telefone, endereço ou valores.
- **Não configure** `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED`, `DFL_TRACKING_GATE1_ACTIVE`, `DFL_TRACKING_BACKGROUND_CAPTURE` nem `tracking_capabilities_v1` nesta release. A central pode informar 'indisponível' no ambiente OFF; isso é proposital e não deve ser contornado.
- A foto/status local no card é apenas busca e contexto; `inspection.readiness.source=confirmed_server_snapshot` depende do backend autenticado.
- A inspeção não afirma aceitação de WhatsApp sem comprovante; `origin='loja'` é tratado como manual legado. Marketplaces permanecem bloqueados para emissão/compartilhamento.
- Nenhum segredo, token público ou HMAC entra no APK. Botão de copiar exporta somente projeção pública.
- Em offline, seleção local continua possível, mas confirmação no servidor fica indisponível sem bloquear entregas.

## Handoff ao Site (R251 ou posterior)

Contrato externo permanece `dfl.tracking.public.v1` implementado por R249. O Site NUNCA chama `/admin/inspect` e NUNCA recebe Firebase Admin. Os contratos de cliente continuam:

- `POST /api/integration/tracking/v1/authorize` (HMAC S2S) — troca token por `scope_handle`.
- `POST /api/integration/tracking/v1/status` (HMAC S2S) — retorna allowlist B e revalida grant/revogação.
- `POST /api/integration/tracking/v1/issue` e `/revoke` são privados owner-only; o Site não solicita nem emite por conta própria.

O Site deve criar `/acompanhar#t=token`, remover o hash imediatamente da URL, trocar por cookie HttpOnly restrito, revalidar consulta em cada refresh, usar `Cache-Control:no-store`, `Referrer-Policy:no-referrer` e CSP sem scripts externos no momento da captura. O servidor do Site assina `METHOD\nPATH\nSHA256(body)\ntimestamp\nnonce\nkid\ntenant` com HMAC SHA256; segredos só backend. Os módulos permanecem OFF até homologação compartilhada Firestore e browser/APK.

## GATES de homologação

Instalador verifica HEAD R249 remoto e local, 3 blobs rastreados, stage, hashes, tests, TypeScript integral, PRE-APK completo, Firestore audit estática, e diff. Commit/push seletivo apenas com 100% aprovado. Testes do núcleo com banco simulado não comprovam políticas Firestore, índices ou comportamento operacional Android. Nenhuma regra ou coleção é migrada por este pacote.

### Ainda faltará antes de liberar publicamente

- Homologação da emissão/expiração/revogação em Firestore real com tenant e concorrência, callbacks e limites de leitura.
- Integração real da sessão no Site e teste de privacidade com dois pedidos / múltiplos dispositivos.
- Evolução dos pontos de gravação de eventos operacionais reais que atualmente não guardam data/autoria/revisão (R249 evita fabricar esses dados).
- Acompanhamento da linha do tempo no Site e testes de UX no Android.
- Mensageria seletiva, habilitação e rollout controlado em fase separada.

## Como verificar no APK/PWA

1. Na conta proprietária: `Mais → Central de Acompanhamento`; selecionar pedido e conferir indicação de modo OFF. Em conta de colaborador, opção não aparece.
2. Abrir detalhes de entrega: atalho administrativo, sem substituir o fluxo de edição, pagamento ou conclusão.
3. Desativar internet: busca local continua; inspeção não afirma evento recente.
4. Nenhum WhatsApp, link de cliente ou lançamento financeiro será criado.

Este relatório NÃO representa habilitação pública. R250 prepara experiência interna e contrato para que a equipe do Site desenvolva a página em paralelo.
