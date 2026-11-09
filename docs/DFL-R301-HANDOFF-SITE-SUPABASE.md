# R301 — Entregas / Site / Supabase — retirada manual v2

Data: 2026-11-09. Contrato sem liberar WhatsApp. Abertura real somente em canário.

## Autoridade e eventos

Entregas produz exclusivamente `source=manual`, `order_id=entregas:dfl-*`,
`event_type=order.created` ao cadastrar a retirada e `event_type=order.ready`
ao marcar **Pronto para retirada**. Em ambos, `event_id` tem forma
`manual-msg-v2__{event_type}__{delivery_id}__{transition_key}`, onde a chave
SHA-256 identifica a fase e o horário confirmado de criação/prontidão.

A origem `dfl_site` **nunca** passa por este produtor. Entrega da plataforma,
retirada de balcão, testes, pedidos internos, sem opt-in e sem telefone válido
são bloqueados. Prontidão comercial não é pagamento nem retirada concluída.

O produtor faz leitura Firestore, reserva atômica em
`manual_pickup_events_v2`, releitura após reserva e POST HMAC no Site. Uma
resposta incerta (erro/timeout) fica reservada para revisão humana, sem replay.

## Compatibilidade Site

Site R37 já mantém receptor R33 `r33ValidManualPickup`, envelope v2,
consentimento e canário; utiliza HMAC `${timestamp}.${body}` (epoch em ms,
hex puro) e transmite para ingest via token servidor. Não mandar o usuário
abrir link para confirmar; nenhuma ação de prontidão remove eventos da venda.

## Supabase

`dfl-messaging-ingest` v12 (publicada 2026-11-09):
`source_event_id` bruto para **manual next_stop v2** e **manual pickup v2**.
Dedupe por `(source,source_event_id)` permanece igual para outros eventos.
`dfl-messaging-worker` v22 mantém TTL na hora de enviar, one-shot, revisão
sem retransmissão incerta e template de retirada. Nenhuma env flag foi alterada.

## Ordem de homologação; gates OFF por padrão

1. Entregas R301 local aprovada: testes novos, regressões, `tsc --noEmit`, PRE-APK global.
2. Publicar Entregas separadamente; confirmar HEAD e deploy. Site R37 deve continuar READY.
3. Checar configurações antes de canário; flags independentes Entregas, Site,
   Supabase ingest e worker e kill switches. Ativar **somente com telefone
   piloto, consentimento explícito, boundary de ativação e monitoramento real**.
4. Homologar novo pedido de retirada manual, exatamente uma confirmação;
   em outro aparelho marcar prontidão, exatamente um aviso `order.ready`.
5. Homologar dois aparelhos simultâneos, duplicação, reinício, timeout,
   ausência de opt-in e pedido Site; no máximo um envio por fase.
6. Inspecionar outbox, `provider_message_id`, erro/dead_letter, sem reenvio automático.
7. Apenas depois considerar rollout, com rollback e kill switch supervisionados.

**Não** cadastrar número de telefone fictício em produção nem inferir entrega
confirmada por `queued`. **Não** reprocessar uma reserva `uncertain` sem auditoria.
