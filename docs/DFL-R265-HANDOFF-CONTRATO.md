# DFL Entregas R265 — Handoff certificado ao Site

Base comercial auditada: `b8cc14f2d95b0c49ff6f4c94cfe9a0f428a51a80`.
Site R264 já oferece entrada opcional `TrackingLinkEntry` em Meus pedidos.

## Autoridade e fluxo

1. O **proprietário autenticado** seleciona um pedido na Central de Acompanhamento do Entregas, verifica o diagnóstico do servidor e confirma o envio manual. A operação exige flags e capabilities previamente autorizadas; nenhuma tela pública emite acesso.
2. O Entregas chama **somente** seu endpoint existente `POST /api/integration/tracking/v1/issue`, `Authorization: Bearer <FIREBASE_ID_TOKEN_DO_OWNER>` e JSON:

```json
{"contract":"dfl.tracking.access","version":1,"action":"issue","order":{"canonical_order_key":"site:ID_VALIDADO","origin":"site"},"idempotency_key":"STRING_ALEATORIA_16_A_96","requested_ttl_minutes":45}
```

Use `origin:"manual"` com `entregas:ID` para pedido manual, e `origin:"site"` com `site:ID` para pedido do Site. Nunca forneça `canonical_order_key` do navegador do cliente como fonte de autoridade. O Entregas faz resolução e validação no servidor.

3. A resposta `201` contém somente uma vez `contract`, `version`, `grant_id`, `opaque_token`, `expires_at`, `status:"issued"`. A Central constrói **em memória** `https://dafamilialanches.com.br/acompanhar#t=<opaque_token>` e só mostra o botão de cópia sob comando do proprietário. Token nunca é registrado nem retornado em uma segunda consulta.
4. O operador compartilha manualmente com o cliente correto por canal autorizado. **Não há envio automático de WhatsApp neste release.** Um pedido sem cliente reconhecido não recebe token por conta própria.
5. Meus pedidos (Site) abre um **link privado já recebido**, validando domínio e formato via `TrackingLinkEntry` / `parseTrackingLink`; não emite, não descobre, não consulta por ID/telefone. O destino troca o token em `POST /acompanhar/api/session`, remove o fragmento da barra do navegador e mantém o contexto em cookie HttpOnly; `GET /acompanhar/api/status` retorna a projeção estrita, sem PII.
6. O backend Entregas recebe `POST /api/integration/tracking/v1/authorize` e `/status` **somente via servidor Site** com HMAC-SHA256 e proteção contra replay. Os envelopes são respectivamente `{"contract":"dfl.tracking.access","version":1,"action":"exchange","opaque_token":"<43_CHAR>"}` e `{"contract":"dfl.tracking.access","version":1,"action":"status","scope_handle":"<OPAQUE>"}`. Não usar o token de origem para chamadas subsequentes.
7. O proprietário pode revogar o último grant emitido durante a sessão administrativa via `POST /api/integration/tracking/v1/revoke` (owner-only), `{"contract":"dfl.tracking.access","version":1,"action":"revoke","grant_id":"<SHA256_64_HEX>","reason":"admin_action","idempotency_key":"<RANDOM_16_96>"}`. A revogação invalida as sessões atuais ao mudar a geração do grant. Não assume sucesso em falha HTTP.

## Elegibilidade

- Site: exige evento comercial persistido `confirmed` / `preparing` / `ready`, com ID canônico validado e pertencente à empresa.
- Manual: exige `tracking_manual_acceptances_v1` emitido pelo owner via `/confirm`, com ID canônico validado e mesmo tenant; alocar em rota **não** equivale ao aceite.
- `ifood` e `food99`: não emitir. `counter` e `external_delivery`: não emitir até política própria. `pickup`: permitido com identidade **retirada**, sem inferir despacho ou motoboy mesmo se o registro legado contiver `route_id`. O Site deve mostrar conclusão de retirada como **Retirado** (não **Entregue**) quando `order.fulfillment=pickup`.
- Pedido concluído, cancelado ou descartado: não emitir novo link.
- Sem varredura histórica, sem emissão retroativa em lote, sem acesso por ID público. Reemissão exige revogar o grant anterior e emitir outro manualmente. O token é consumido uma única vez e a sessão vence até 30 min, nunca após expiração do grant.

## Gates e segurança

- `DFL_TRACKING_GATE1_ACTIVE` e `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED`: OFF por padrão; tenant, capability, modo, `kill_switch` e origem devem ser aprovados. Site `DFL_SITE_TRACKING_ENABLED`: OFF até autorização expressa.
- Não armazenar token em Firestore, localStorage, sessionStorage, cookies legíveis, query string, logs, relatórios ou analytics. **Somente hash** no banco e apresentação efêmera ao proprietário durante a emissão.
- O token em fragmento `#t` é enviado ao Site no navegador de destino somente na ação de troca, jamais nos logs do servidor pela URL inicial.
- Checkout, PIX, bot, VPS, Finance e mensagens atuais permanecem inalterados.
- URL pública sempre fixa à origem autorizada. Nunca confiar em `Host` ou `X-Forwarded-Host` para construir link.

## Pendências que não devem ser ocultadas

- A entrega **automática** de link diretamente ao cliente autenticado em Meus pedidos não faz parte deste contrato, pois exige comprovação servidor-servidor de titularidade da sessão do comprador. Não usar `order_id`, nome, telefone digitado ou cookie anônimo como substituto dessa prova.
- A tela administrativa só revoga o último grant emitido enquanto a Central permanece aberta; revogação anterior ainda existe via API owner-only. Um diagnóstico/listagem admin de grants pode ser adicionado em release futuro.
- Expiração física de documentos Firestore (TTL), índice composto e rastreio de custos precisam de auditoria antes de ativação pública. O vencimento lógico do grant e sessão já é validado a cada uso.
- Publicação do código **não** significa ativação pública; homologação E2E fictícia e autorização expressa ainda são exigidas.
