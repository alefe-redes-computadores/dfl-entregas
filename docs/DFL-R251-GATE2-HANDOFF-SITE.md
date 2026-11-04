# DFL ENTREGAS → DFL SITE — R251 Gate 2: integração segura

## Estado e isolamento

A R249 criou os endpoints de acompanhamento e os schemas V1. A R250 criou o painel privado de inspeção. A R251 adiciona validação de allowlist estrita, certificado administrativo read-only e 14 cenários fictícios completos. Os recursos de acesso público, emissão de links e mensageria permanecem OFF por padrão. Nenhum arquivo do Site, Firebase Rules, Finance ou Combo V3 é alterado.

### Endpoints S2S (Entregas, exclusivos para servidor do Site)

- `POST /api/integration/tracking/v1/authorize` — troca token opaco por handle restrito.
- `POST /api/integration/tracking/v1/status` — projeção pública B, com autorização/revogação verificada a cada chamada.

**IMPORTANTE:** esses endpoints não estão liberados para uso público nem para homologação com clientes. O Site pode desenvolver sua implementação inicialmente com fixtures locais. URLs internas do Entregas devem ser configuradas pelo Site, nunca copiadas com credenciais para navegador.

### Assinatura

O servidor do Site calcula SHA256 do corpo UTF-8 **exatamente enviado**, e assina em HMAC-SHA256 a sequência canônica:

```
METHOD\nPATH\nSHA256(body)\ntimestamp\nnonce\nkid\ntenant
```

Cabeçalhos: `x-dfl-tracking-timestamp`, `x-dfl-tracking-nonce`, `x-dfl-tracking-kid`, `x-dfl-tracking-signature`. Relógio UTC, nonce aleatório por chamada; validação rejeita replay. Chaves em `DFL_TRACKING_S2S_KEYS_JSON` ficam no backend Entregas e correspondente cofre do Site; nunca no JS cliente.

### POST authorize

```json
{"contract":"dfl.tracking.access","version":1,"action":"exchange","opaque_token":"<token-aleatorio-43-caracteres>"}
```

Resposta de sucesso: `{ "contract": "dfl.tracking.access", "version": 1, "authorized": true, "scope_handle": "<opaco>", "scope_expires_at": "<ISO>" }`.

### POST status

```json
{"contract":"dfl.tracking.access","version":1,"action":"status","scope_handle":"<opaco>"}
```

Resposta de sucesso: apenas `dfl.tracking.public.v1` conforme `contracts/tracking/v1/schemas/B-public-projection.v1.schema.json`. R251 rejeita campos extra ou privados, progresso incerto, ETA, GPS e outros dados não permitidos.

### Erros, privacidade e sessão no Site

- `401` assinatura inválida; `409` replay; `422` envelope inválido; `429` limitação; `404/503` token/sessão indisponível ou serviço OFF. Todos genéricos, `Cache-Control:no-store`.
- No Site `/acompanhar#t=<token>`: capturar fragmento apenas na página isolada, removê-lo do histórico da aba imediatamente, trocar por sessão HttpOnly Secure SameSite com Path limitado, sem armazenamento persistente, sem scripts terceiros na entrada, CSP e `Referrer-Policy:no-referrer`.
- Consulta de status sempre pelo backend Site com S2S; **nunca do navegador diretamente para Entregas**. Em cada consulta, Entregas revalida grant, geração e revogação. Se revogado, o Site limpa a tela/sessão e cache.
- Não mostrar conclusão baseada em `route.completed`; não aceitar `order.created` como aceite; não inferir atual stop, GPS ou ETA.
- Não tratar liberação dos endpoints em produção como autorização para ativar. A homologação exige dois pedidos, dois dispositivos e revogação imediata.

### Contratos para desenvolvimento visual sem ambiente real

O laboratório proprietário `Mais → Central de Acompanhamento → Laboratório` oferece 14 exemplos de JSON **completamente fictícios** (recebido, agendado, preparo, pronto, alocado, despacho, agrupamento, reorganização, reconciliação, entregue, cancelado, retirada, desatualizado, intercorrência), todos produzidos pelo mesmo projetor público do Entregas. Use esses cenários como guia de interface e testes do Site. Eles não representam Firestore de produção.

### Variáveis de ambiente (nomes, não valores)

- `DFL_TRACKING_GATE1_ACTIVE` — código backend gate, padrão OFF.
- `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED` — exigido para sessão pública, padrão OFF.
- `DFL_TRACKING_TENANT_ID` — tenant estrito para dados operacionais.
- `DFL_TRACKING_LEGACY_TENANT_ID` — somente migração legada autorizada, com isolamento.
- `DFL_TRACKING_S2S_KEYS_JSON` — key IDs e segredos para HMAC, backend somente.

**Não configurar nem ativar esses flags durante construção da página do Site.**

### Testes conjuntos antes de liberar

1. Token de pedido A jamais abre B.
2. Token de empresa A jamais abre B.
3. Token expirado e revogado bloqueado.
4. Revogação de grant invalida a sessão já aberta no próximo status.
5. Captura de fragmento sem vazamento em logs, analytics, referer, persistência ou service worker.
6. Site não confunde recebimento, aceite, alocação, despacho, entrega e rota encerrada.
7. Reordenação/conflito: progresso `null` até evidência reconciliada.
8. Vários pedidos no mesmo endereço preservam suas identidades.
9. Nenhum terceiro, endereço, telefone, financeiro ou ID interno na resposta pública.
10. Offline, timeout e erro de integração nunca bloqueiam checkout ou rotas.
11. PWA/Android: retorno, recarregamento, safe-area, scroll e teclado.
12. Nenhuma mensagem real; mensageria comercial e pickup_ready do Site preservados.

## Handoff

**O Site já pode implementar a página protegida sobre fixtures V1** e preparar S2S em modo inativo. A ativação posterior exige gates específicos e homologação conjunta. R251 mantém a fonte operacional do Entregas e não executa uma migração ou captura de eventos automática.
