# DFL ENTREGAS — R249 Gate 1 · Núcleo interno de acompanhamento V1

**Base obrigatória:** Entregas `59ed1dd04e98d1bea303ca47d26e09198a50844a` (R247); Site R251 homologado por seu chat. Implementação interna, sem ativação pública e sem mudanças no Finance, DFL Assist, Combo V3, regras Firebase ou VPS. **Este pacote não configura credenciais ou settings em produção.**

## Entregas concretas

- 11 JSON Schemas e 16 fixtures do Gate 0 V1.1, preservados sem adulteração.
- Projeção `dfl.tracking.public`/1 com allowlist estrita de campos, timeline máxima 30, timestamps confirmados, agrupamento de paradas físicas, posição planejada separada da parada atual comprovada. Sem ETA/GPS nem informações financeiras/administrativas.
- Ledgers `tracking_event_ledgers_v1` criados apenas por comando confirmado e habilitado, com documento `operational_event` auditável conforme schema A. Reconciliação idempotente de fontes persistidas (sem falsificar hora de alocação ausente).
- Endpoints Node, **POST** `/api/integration/tracking/v1/{issue,revoke,authorize,status,confirm,sync}`. Todos indisponíveis por padrão.
- Credenciais aleatórias de 256 bits, derivado SHA256 armazenado em backend, grant por empresa+pedido, token de saída exibido uma vez, sessão opaca e revogação de sessões anteriores em cada consulta.
- Assinatura HMAC-SHA256 entre servidores com key-id, hash de body, método, path, timestamp RFC3339 UTC, nonce e tenant. Dedupe atômico do nonce, rate limit de troca e de consulta.
- Superadministrador, validado com token Firebase revogado, autoriza comandos privados. Empresa checada por campo persistido (`tenant_id`/`company_id`) ou pelo escopo legado único explicitamente configurado.
- Configuração empresarial fail-closed (documento ausente significa `OFF`): modos `OFF`, `DRY_RUN`, `MANUAL`, `AUTOMATIC_CERTIFIED`; flags de acesso e eventos separadas, kill switch obrigatório. Intenções simuladas sem número ou transporte real, e só se evento foi habilitado para DRY_RUN.
- Ligação **opcional e OFF** ao reconciliador de eventos existente, sem nova varredura global. Histórico manual e WhatsApp exige aceite explícito; marketplace permanece inelegível até política própria.

## Endpoints privados: contratos exatos

### Emissão (admin Firebase owner-only)

`POST /api/integration/tracking/v1/issue`

```json
{"contract":"dfl.tracking.access","version":1,"action":"issue","order":{"canonical_order_key":"entregas:pedido-exemplo","origin":"manual"},"idempotency_key":"emissao-exemplo-unica-001","requested_ttl_minutes":120}
```

Retorna `201` com `contract`, `version`, `grant_id`, `opaque_token`, `expires_at`, `status:"issued"`, somente uma vez. Repetição retorna `409` sem reexibir segredo. Recusa pedido sem aceite expresso; pedido do Site exige transição comercial persistida, não `order.created`.

### Revogação (admin Firebase owner-only)

`POST /api/integration/tracking/v1/revoke`

```json
{"contract":"dfl.tracking.access","version":1,"action":"revoke","grant_id":"hash-hexadecimal-de-64-caracteres","reason":"admin_action","idempotency_key":"revogacao-exemplo-unica-001"}
```

Retorna `200` com `contract`, `version`, `grant_id`, `revoked:true`, `revoked_at`. A revogação administrativa continua possível quando o kill switch já foi acionado (desde que o código interno permaneça ativo).

### Troca Site → Entregas (HMAC servidor-servidor)

`POST /api/integration/tracking/v1/authorize`

```json
{"contract":"dfl.tracking.access","version":1,"action":"exchange","opaque_token":"<CSPRNG_BASE64URL_43>"}
```

Retorna `200` com `contract`, `version`, `authorized:true`, `scope_handle` e `scope_expires_at`. O Site deve colocar uma **sessão restrita em cookie HttpOnly**; nunca o token original em URL após ler fragmento, logs, storage ou analytics.

### Consulta Site → Entregas (HMAC servidor-servidor)

`POST /api/integration/tracking/v1/status`

```json
{"contract":"dfl.tracking.access","version":1,"action":"status","scope_handle":"<ESCOPO_OPACO_DA_SESSAO>"}
```

Retorna **somente** schema B `dfl.tracking.public.v1` em `200`. Verifica token de sessão, grant, geração, expiração, empresa, modo e revogação **a cada consulta**. Um `order_id` extra é rejeitado com `422`. Não aceita browser nem Firebase client.

### Operação interna

`POST /api/integration/tracking/v1/confirm` com `{"contract":"dfl.tracking.confirm","version":1,"delivery_id":"pedido-exemplo","idempotency_key":"confirmacao-exemplo-001"}`; somente owner e pedidos manuais elegíveis. Isto NÃO altera status do Site nem dispara WhatsApp.

`POST /api/integration/tracking/v1/sync` com `{"contract":"dfl.tracking.sync","version":1,"delivery_id":"pedido-exemplo"}`; reconcilia fatos já persistidos, limite de uma entrega por chamada. Não inventa histórico comercial anterior.

### Assinatura HMAC (somente servidor)

Cabeçalhos: `x-dfl-tracking-timestamp` (UTC ISO como `2026-11-04T13:00:00.000Z`), `x-dfl-tracking-nonce` (aleatório ≥20 caracteres), `x-dfl-tracking-kid` e `x-dfl-tracking-signature` (hexadecimal 64 caracteres).

Conteúdo canônico UTF-8 para assinar com HMAC-SHA256:

```
METHOD
PATH
SHA256(rawBodyUtf8) (hex)
RFC3339_TIMESTAMP_Z
NONCE
KEY_ID
TENANT_SCOPE_CONFIGURADO_NO_SERVIDOR
```

Ex.: `POST`, `/api/integration/tracking/v1/status`. A assinatura é sobre os **bytes brutos** do corpo enviado; o Site precisa gerar chave/assinatura **apenas no servidor**. HMAC confidencial e tenant são parâmetros internos, não selecionáveis pelo cliente.

### Erros

`401` assinatura inválida ou credencial administrativa inválida; `403` feature OFF/sem permissão; `404` recurso ou grant ausente/expirado/revogado de forma indistinguível; `409` nonce já usado/idempotência; `422` payload incompatível; `429` limitação; `503` dependência/versão não certificada. Erro uniforme sem PII/segredos: `{"error":{"code":"TRACKING_UNAVAILABLE","message":"Não foi possível acessar o acompanhamento. Confira o link ou tente mais tarde."}}`.

## Variáveis de ambiente — não configurar/ativar neste release

| Nome | Padrão quando ausente | Função |
|---|---|---|
| `DFL_TRACKING_GATE1_ACTIVE` | OFF | Pré-requisito para rotas e registros internos |
| `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED` | OFF | Habilitação **posterior** de consultas e emissão após homologação |
| `DFL_TRACKING_BACKGROUND_CAPTURE` | OFF | Adaptação limitada ao reconciliador existente, quando autorizada |
| `DFL_TRACKING_TENANT_ID` | inválido/nega | Tenant único do ambiente |
| `DFL_TRACKING_LEGACY_TENANT_ID` | inválido/nega | Legado sem tenant explícito pertence SOMENTE ao tenant declarado |
| `DFL_TRACKING_S2S_KEYS_JSON` | inválido/nega | Objeto privado `{keyId: segredoAleatorioLongo}`, 1–4 chaves para rotação; secret >=32 caracteres |

Também exige documento autoritativo Firestore `tracking_capabilities_v1/{tenant}` com `mode`, `kill_switch:false`, `public_tracking:true`, `issue_tracking_link:true`, `show_position`/`show_courier`, `eligible_origins`, `event_modes` quando certificados. **Nenhum desses ajustes é realizado por esta cirurgia.** Ausência do documento significa OFF/kill switch ligado. Nunca colocar chaves no APK, variáveis `NEXT_PUBLIC_`, ou chat.

Coleções futuras e somente se Gate1 for ativado: `tracking_event_ledgers_v1`, `tracking_manual_acceptances_v1`, `tracking_grants_v1`, `tracking_token_index_v1`, `tracking_sessions_v1`, `tracking_replay_nonces_v1`, `tracking_rate_limits_v1`, `tracking_dry_run_intents_v1`. Antes de ativar, homologar TTL/retention e o custo do contador/nonce; **este release não configura TTL** nem regras/migrações.

## Importante: lacunas de homologação antes de ativar publicamente

1. Testes completos de Firestore em emulador com transações e concorrência distribuída, índices, TTL, proteção contra replay e isolamento real.
2. Provar compatibilidade real do Site R251 com HMAC/cookie/CSP/no-store e revogação no navegador/PWA Android, incluindo Voltar/bfcache.
3. Eventos de alocação e reordenação legados não têm em todos os registros horários/revisões confirmados; o reconciliador **não cria fatos que não consegue provar**. Para atingir histórico completo, novas transições precisam receber metadados canônicos no ponto de persistência operacional após homologação.
4. No Gate1, somente fluxos Site têm captura automática opcional via worker quando habilitados; pedidos manuais usam `/confirm` e `/sync` administrativamente. A UI de confirmação e a página pública serão responsabilidade de macrocirurgias posteriores; não estão expostas agora.
5. A classificação WhatsApp/balcão não é canônica no schema legado `origin='loja'`; preservar como Loja até definir `order_channel` persistido. Não compartilhar marketplace sem permissão da plataforma.
6. Antes de ativar qualquer sessão, verificar autorização de produção, rate-limit a montante, e lifecycle/cancelamento. As políticas não devem depender exclusivamente do frontend.
7. Nenhuma mensagem é enviada pela VPS; `dry_run` é auditoria interna apenas, não comprova entrega.

## Testes / entrega

- `node scripts/test-r249-gate1-tracking.cjs` — 137+ testes de módulos puros e backend simulado.
- `node scripts/pre-apk.cjs` — suítes legadas + Gate1.
- `./node_modules/.bin/tsc --noEmit` — verificação TS integral.
- `git diff --check`, auditoria Firestore estática, allowlist e stage exatos.
- Commit e push seletivos somente com todos os gates aprovados; homologação Firefox/PWA/APK/Firestore/certificação pública permanece separada.

**Finance, Combo V3, DFL Assist, Site, VPS, Regras, integração financeira e app do cliente não são alterados.**
