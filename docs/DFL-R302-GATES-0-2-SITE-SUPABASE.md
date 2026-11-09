# DFL Entregas R302 — Gate 0–2, homologação hermética da Mensageria 360

Referência: 09/11/2026. Este pacote **não envia mensagens, não ativa flags, não altera Supabase/Site, não publica e não faz commit**.

## Autoridades e referências verificadas

- Entregas: `b4ed6f372bf79c108753d4c2523ea4a0a5705ffd` (R301), GitHub main.
- Site: `62a08c735f4df006dd8eb4cae7eac344222a21cd` (R37), GitHub main no início da auditoria.
- Supabase conectado (projeto já existente): `dfl-messaging-ingest` **v12**, `dfl-messaging-worker` **v22**, `dfl-messaging-audit` **v1**. Versões verificadas por leitura das funções; suas flags secretas não foram presumidas nem alteradas.
- R301 já produz `order.created` e `order.ready` v2 em retirada manual, com consentimento e reserva atômica no Firestore.
- Site R32/R33 já possui receptor com HMAC S2S e validação dos envelopes. **Não reconstruir** Site, outbox, worker ou Evolution.

## Defeito preventivo corrigido na R302

O produtor `lib/integration/server/manualNextStop.ts` da R300 P2 selecionava `plan.nextDeliveries` por pedido, embora a mensagem fosse por **transição de parada física**. Quando uma única parada contém duas comandas do mesmo cliente/telefone, o mesmo WhatsApp poderia receber duas mensagens com `source_event_id` distintos. Se uma comanda do grupo fosse concluída após o primeiro aviso, a outra ainda poderia se tornar nova candidata.

A R302 agrupa candidatos **por telefone normalizado**, seleciona representante estável por ID e reserva `manual_next_stop_transitions_v2` usando `{routeId, transitionKey, telefone}` em vez de ID da comanda. A identidade externa v2 do envelope e o HMAC permanecem intocados. Se a parada anterior estiver parcialmente concluída, nenhuma nova transição é autorizada; se apenas uma comanda da próxima parada for concluída, a reserva pré-existente bloqueia novo aviso.

Uma transição física **diferente** para a próxima parada tem uma chave nova, logo seu aviso autorizado continua possível. Flags novas permanecem OFF até canário.

## Gates de execução do instalador

1. Confere SHA do pacote, HEAD remoto/local Entregas R301, branch, arquivos permitidos e ausência de staged/alterações externas.
2. Confere existência/estado local do Site, sem escrever nele; seu HEAD deve incluir o commit R37, e os módulos R32/R33 não podem ter alterações locais.
3. Antes de modificar o repo, confere âncoras exatas nos dois arquivos rastreados da R301; faz backup seletivo.
4. Modifica somente `lib/integration/server/manualNextStop.ts` e `scripts/pre-apk.cjs`; adiciona o novo teste `scripts/test-r302-next-stop-dedupe.cjs` e este documento.
5. Executa os testes de comportamento do produtor e regressões R300/R301, cruza **políticas reais** do Site R32/R33, executa suites herméticas do Site, TypeScript e PRE-APK global do Entregas.
6. Em qualquer falha, restaura somente os rastreados da R302 e remove somente seus novos arquivos, mantendo os logs.
7. **Não faz `git add`, commit, push, deploy, configuração de env, envios ou chamadas a serviços externos durante os testes.** O preflight consulta somente o HEAD remoto Git, sem acessar dados de cliente.

## Aceites e limites

- Aprovado em ambiente isolado antes de empacotar: 65 verificações do produtor físico (6 paradas, 7 pedidos) e 32 verificações cruzadas de contratos puros. O aceite completo de TypeScript, Site local e PRE-APK depende do Termux.
- `queued` é fila, `sent`+ID do provedor é aceite da API, não leitura/recebimento no telefone. **Não declarar entrega do WhatsApp sem observação do piloto.**
- Nenhum teste hermético valida secrets reais. Antes do canário, revisar flags (Site, Entregas, ingest, worker) somente por nomes/existência, sem exibir valores; certificar owner e HMAC.
- Canário deve ser explicitamente autorizado por telefone; não realizar com pedidos reais históricos, nem reprocessar dead letters históricos.
- Próximas homologações: retirada manual criada/pronta, seguida de próxima parada física, sob canário restrito; após testes, voltar as flags de novos eventos ao estado OFF caso não haja autorização expressa de rollout.

## Matriz de eventos

| Evento | Autoridade | Estado R302 |
| --- | --- | --- |
| `order.created`, `order.ready` comerciais Site | Site | Código existente, fora do patch |
| `order.created` e `order.ready` de retirada manual v2 | Entregas R301 → receptor Site R33 | Envelopes testados, envio real ainda pendente |
| `delivery.next_stop` de parada manual v2 | Entregas R300/R302 → receptor Site R32 | Deduplicação física reforçada, envio real pendente |
| Outros eventos manuais v1 | Entregas/Site existentes | Inalterados |
| Template/WhatsApp/transportes | Supabase worker v22 → Evolution | Inalterados |
| Tracking P9, bot Finance | Sistemas existentes | Fora de escopo |

**Conclusão:** pronto para gates técnicos offline; **não liberado para disparos reais** sem canário documentado.
