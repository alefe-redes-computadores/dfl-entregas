# DFL 360 R75 P2 — Recuperação assistida, sem reenvio cego

## Escopo
Complementa a R75 P1 publicada no Entregas. A Central de Mensageria passa a permitir, apenas ao superadministrador autenticado que já tem acesso à consulta, copiar **uma mensagem nova e neutra para contato humano individual** em casos `dead_letter` e `failed` selecionados.

Nenhum aviso original é reenviado. O botão nunca chama a Evolution, Supabase, tracking, Firestore, ingest, API de replay ou WhatsApp; apenas escreve texto no clipboard mediante duas confirmações. Não há telefone, ID técnico, preço, endereço, link privado ou token no texto copiado. **Cabe ao operador confirmar o caso com o cliente e fazer o contato manual fora do app.**

A auditoria deve ser íntegra, atual (< 3 minutos), completa, do exato pedido selecionado. Sem consentimento, sem telefone, em pedido concluído, com origem marketplace/Site, ou diante de registro `sent`, `pending`, `processing`, `suppressed`, ambíguo ou sem evidência, o painel bloqueia a assistência. Registros com `providerAccepted` nunca habilitam assistência.

## Links com `delivery_uncertain`
Links privados continuam no fluxo independente de tracking, com TTL de 90 minutos. Não reabrir/reaproveitar token antigo, não gerar outro automaticamente e não deduzir entrega do status de mensagens normais. O operador consulta Acompanhamento; nova emissão requer o fluxo de consentimento e a política vigente. Nenhum link é copiado por esta cirurgia.

## Limites de segurança
A ausência de aceite registrado não comprova ausência de envio. O sistema **não tenta** inferir que os dois avisos de retirada de 15/11 não chegaram: eles continuam retidos para revisão. O botão não marca o banco como `sent` e não certifica recebimento. A proteção contra reenvio automático da R33 é preservada.

## Publicação
Nenhuma migração no Supabase, novos segredos ou deploy de worker. Publicação apenas no Entregas, após R75 P1 e todos os gates locais. Qualquer automatização real de reenvio exigiria prova independente de não entrega e projeto separado.
