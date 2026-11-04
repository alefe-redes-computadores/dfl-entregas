# DFL R254 — Gate 5: prova mútua de conexão Entregas ↔ Site (OFF)

**Base publicada no Entregas antes do pacote:** `f4de2ebfffb2b29679aeca0064fe13b99962f6ed` (R253). Em 04/11/2026, `Site/main` `ee716ca5c798d6cb5dd757f769798e4d2faaf8f4` não continha `/acompanhar`. Não afirmar que a integração entre produções já foi homologada.

## Propósito

Este pacote adiciona uma **prova S2S autenticada, de mão dupla, isolada do público**, sem cliente, pedido, sessão, rota, pagamento ou mensageria. O Site envia um desafio aleatório e assinado; o Entregas valida HMAC/tenant/horário/nonce persistido, assina uma prova de resposta e devolve somente um hash do desafio. O Site verifica o HMAC de resposta com o segredo configurado *apenas no backend*. Qualquer erro retorna indisponível, sem promover a funcionalidade pública.

**Não implica liberação do acompanhamento.** Os contratos existentes `dfl.tracking.access` e `dfl.tracking.public` permanecem. As APIs `authorize` e `status` continuam bloqueadas pelas condições anteriores. A flag do handshake não autoriza cliente e não substitui o gate de ativação ou o aceite comercial.

## Endpoint assinado

`POST /api/integration/tracking/v1/bridge` no servidor Entregas, `Content-Type: application/json`, `Cache-Control: no-store`.

Corpo exato, sem campos extras:

```json
{"contract":"dfl.tracking.bridge","version":1,"action":"probe","challenge":"CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"}
```

`challenge`: 32–96 caracteres base64url, idealmente 32 bytes de CSPRNG em base64url. Nunca usar o exemplo estático em execução real.

Cabeçalhos:

```
x-dfl-tracking-timestamp: 2026-11-04T15:00:00.000Z
x-dfl-tracking-nonce: <nonce aleatório base64url, 20-90 caracteres>
x-dfl-tracking-kid: <identificador de chave configurada>
x-dfl-tracking-signature: <HMAC SHA256 minúsculo>
```

Assinar bytes exatos de:

```
POST
/api/integration/tracking/v1/bridge
sha256(corpo_json_exato)
timestamp
nonce
kid
tenant
```

Apenas backend Site conhece tenant, `kid` e segredo. Nunca expor em `NEXT_PUBLIC_*`, logs, analytics, cliente, APK ou query string. Reusar a função referencial `lib/tracking/gate5/bridge-protocol.ts` *somente no backend Node*. A montagem de `authorize`/`status` continua em `lib/tracking/gate4/site-wire.ts`.

Resposta 200 (valores ilustrativos e não funcionais):

```json
{
  "contract":"dfl.tracking.bridge",
  "version":1,
  "status":"reachable",
  "challenge_hash":"<sha256 hex do desafio>",
  "server_time":"2026-11-04T15:00:00.000Z",
  "proof":"<hmac hex da resposta>"
}
```

Material da prova de resposta, também HMAC SHA256:

```
DFL_TRACKING_BRIDGE_PROOF_V1
/api/integration/tracking/v1/bridge
challenge_hash
nonce
server_time
tenant
kid
```

`verifyBridgeResponse` confere *campos exatamente fechados*, integridade do hash, prova HMAC, tenant, `kid`, nonce e clock ±120 segundos. Não devolver ou armazenar segredos ou corpo original do desafio. A confirmação `connected:true` significa **somente que a conexão S2S com essa configuração respondeu corretamente**; não autoriza acesso a clientes, emissão de link ou disparo de mensagens.

## Configuração e segurança

- `DFL_TRACKING_GATE1_ACTIVE=1` **e** `DFL_TRACKING_BRIDGE_PROBE_CERTIFIED=1` só após aprovação explícita de homologação interna. **O pacote não as define**, nem altera deploy/env.
- `DFL_TRACKING_TENANT_ID` válido e `DFL_TRACKING_S2S_KEYS_JSON` existentes e equivalentes ao segredo do Site. Preferir credenciais próprias de homologação; não compartilhar no chat ou Termux público.
- `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED`, `tracking_capabilities_v1.public_tracking`, `issue_tracking_link`, `event_modes`, WhatsApp e link público continuam OFF.
- Em falha: 422 corpo inválido, 401 HMAC/clock inválido, 409 replay, 503 não habilitado/erro de infraestrutura. Todos retornam erros genéricos e `no-store`.
- Uma requisição aceita grava **somente o nonce de replay** em `tracking_replay_nonces_v1`; não há leituras de entregas, gerações de sessão ou mensagens. Não habilitar no ambiente de produção sem revisar permissões e política de retenção/TTL desta coleção.
- TLS real, timeout curto, `redirect:'error'`, `cache:'no-store'`, `credentials:'omit'`, URL de origem do Entregas explicitamente allowlisted no backend do Site. Não seguir `Location` de qualquer resposta.

## Matriz de homologação obrigatória

1. Default OFF não gera nonce nem responde 200.
2. Assinatura HMAC correta responde 200 e prova verificável.
3. Troca de método, path, corpo, timestamp, nonce, kid, tenant ou segredo falha fechada.
4. Nonce repetido bloqueia; concorrentes com mesmo nonce não recebem dois 200.
5. Resposta modificada, hash errado, clock antigo, campo extra e status não-200 nunca significam conexão autenticada.
6. `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED=0` segue negando consulta pública mesmo com handshake permitido.
7. `status` usa **`validateStrictPublicProjection`**; campos financeiros/privados adicionais ou progresso inconsistente não saem como 200.
8. Resposta sem cache, sem dados pessoais, sem token, sem segredo e sem informação de tenant.
9. PRE-APK R249–R253 + R254, TypeScript integral e auditoria Firestore seguem obrigatórios no Termux.
10. Com o Site implementado: executar uma prova real S2S em ambiente protegido com credenciais efêmeras, depois testes de sessão HttpOnly, revogação ativa, offline, Android/PWA e kill-switch. **Gate 5 local isolado NÃO certifica Gate de ativação pública.**

## Entrega para o Site

O código abaixo é destinado exclusivamente ao servidor do Site:

- `lib/tracking/gate5/bridge-protocol.ts`: builder `buildBridgeProbe` e verificador `verifyBridgeResponse`.
- `lib/tracking/gate4/site-wire.ts`: formato de exchange/status existente.
- `lib/tracking/gate4/site-contract.ts`: fail-closed da projeção pública existente.
- `contracts/tracking/bridge/`: JSON Schema do novo handshake; não altera contrato B v1.

O Site deve implementar `/acompanhar`, troca HttpOnly, anti-CSRF e revogação de cookie em seu projeto. Não portar lógica Firebase admin ou leitura de pedidos para o Site; consumir somente projeção sanitizada via servidor-servidor. Não confundir teste S2S com sessão de cliente.
