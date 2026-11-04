# DFL Entregas R252 — Gate 3, Auditoria operacional por lote

## Propósito

A R251 certifica o contrato de um pedido por vez; a R252 permite revisar amostras de até 20 registros confirmados por ação explícita do superadministrador. A amostra é montada a partir de IDs do cache operacional local (hoje, 7 dias, 30 dias, todo o período; Site/Loja/iFood/99Food). O servidor revalida token Firebase revogável, tenant e evidências reais antes de devolver os resultados. Não constitui prova de que a base inteira foi auditada.

## Nova API interna (NÃO é destinada ao Site público)

`POST /api/integration/tracking/v1/admin/audit` com Bearer Firebase ID Token do superadministrador.

```json
{"contract":"dfl.tracking.gate3.audit_request","version":1,"delivery_ids":["registroA","registroB"]}
```

Apenas 1–20 IDs únicos no formato `[A-Za-z0-9_-]{1,120}`. Corpo até 4096 bytes, somente três campos. CORS para origens nativas explicitamente autorizadas, `Cache-Control: private, no-store`, nenhuma resposta com nome/endereço/telefone/valor ou token. Sem credencial válida `403`, tenant ausente `503`, corpo inválido `422`, indisponibilidade de serviço `503`. Não grava nada, não emite links, não envia mensagens, não altera eventos.

Resposta de sucesso inclui `summary` contrato `dfl.tracking.gate3.batch_audit`, com contagem por origem e situação, razões técnicas de bloqueio e itens owner-only com ID administrativo, estado, evidências e sinais técnicos. O relatório copiado para compartilhar contém somente agregados anônimos, nunca os IDs.

## Segurança e escopo

- Retornos `not_found` incluem pedidos inexistentes e inacessíveis ao tenant, evitando inferir acesso.
- Não existe leitura em render, polling, listeners adicionais ou varredura global; todos os IDs são explícitos.
- No máximo 20 pedidos por requisição, com até três leituras paralelas para conter picos sem bloquear a interface.
- Falha isolada na consulta de um pedido é contabilizada como `inspection_failed`, sem stack trace.
- Números representam somente a amostra selecionada; `internal_reviewable` não significa sessão pública habilitada.
- Nenhuma informação financeira, token, telefone, endereço, GPS ou ETA sai no relatório compartilhável.
- Tudo permanece OFF para clientes, novas mensagens e marketplaces.

## Handoff para DFL Site — usar agora

O Site **não precisa esperar pela R252** para iniciar `/acompanhar`. O contrato S2S estável permanece o da R251 (`dfl.tracking.public.v1`, `POST /authorize` e `POST /status`, HMAC-SHA256 com nonce e kid, troca do fragmento por cookie HttpOnly e revogação em cada status). O Site pode utilizar os 14 cenários fictícios do laboratório Gate 2 para construir a interface.

A R252 adiciona apenas diagnóstico privado para a homologação conjunta. **Não** oferecer `/admin/audit` ao navegador público nem ao backend Site; relatórios anônimos podem ser transmitidos manualmente no chat. Em produção real, a liberação de tracking e WhatsApp depende de gates específicos separados. Finance/Combo V3 ficam fora do escopo.

## Testes

- Requisição de 0, 21, repetidos, IDs inválidos, chaves extras, tamanhos inválidos, sem autenticação ou sem tenant: bloqueada.
- Resposta acessível apenas ao superadministrador; CORS nativo restrito.
- Resultado `not_found` não revela se pedido pertence a outra empresa.
- Modelo de agregação conserva contagens e evita duplicidades nos sinais.
- Cópia externa não inclui IDs, valores, nomes, endereços, telefones ou credenciais.
- Navegação e filtros Android/PWA não criam requisições até apertar Auditar.
- Suítes R249, R250, R251, TypeScript integral, PRE-APK completo, auditoria Firestore, git diff, manifesto e rollback exigidos pelo instalador.

## Integração futura

O Site constrói `/acompanhar` com sua própria sessão protegida e UI premium; Entregas continua autoridade logística. Nenhuma flag nova foi ativada por esta macrocirurgia. O certificado de prontidão A–E permanece **interno**.
