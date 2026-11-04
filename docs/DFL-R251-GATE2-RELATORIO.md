# R251 Gate2 — certificação operacional + laboratório público OFF

Base obrigatória: commit R250 `b03bcb74483ae1c984bcbdc000fabacf8336b070`.

## Escopo da macrocirurgia

- Validador de JSON público reforçado no projetor canônico: valida todas as chaves, nested objects, tipos/enums, timeline, IDs sem duplicação, terminal coerente, progress somente com `out_for_delivery` e freshness `fresh`, paradas inteiras com limites, dados de courier estritos. Rejeita extras financeiros/administrativos, GPS e ETA, sem removê-los silenciosamente.
- Novo laboratório administrativo offline de 14 cenários determinísticos, gerados por `projectPublicTracking` com fixtures fictícias. Compatibilidade com PWA e APK sem depender de rede, Firestore ou tenant.
- Novo endpoint owner-only `GET /api/integration/tracking/v1/admin/certify?delivery_id=...`, read-only, Bearer ID token revogado validado, tenant verificado pelo serviço existente, resposta no-store e CORS nativo restrito.
- Painel A–E por pedido na Central, criado apenas com fatos confirmados. O botão é explícito; nenhuma leitura por card, polling ou listener extra.
- Handoff Site com assinatura HMAC, envelopes, respostas, segurança, experiência Android e testes de contrato. Nenhuma API administrativa é autorizada ao Site.
- Teste obrigatório de regressão das 14 simulações, privacidade estrita, certificados e rota protegida em PRE-APK.

## Proteções

**Não libera clientes, não emite links, não envia WhatsApp, não muda Firebase Rules, não registra finanças ou vendas.** Os exemplos do laboratório são inteiramente fictícios. A certificação A–E é **interna**; estados C e D permanecem OFF e nenhum certificado significa aprovação de segurança de Firestore real.

## Homologação

Instalador valida SHA256, base exata, blobs rastreados, allowlist, stage vazio, TypeScript integral, PRE-APK completo, auditoria Firestore, diff, commit e push seletivos. Em falha antes do commit, rollback apenas das alterações R251; em falha de push, o commit é preservado para retomada.

A ativação pública depende de homologação posterior com dados reais autorizados, dois pedidos/dispositivos, revogação de sessão e evidências de entrega. R251 não altera Gate1 capture automático.
