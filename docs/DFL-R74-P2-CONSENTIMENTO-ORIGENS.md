# R74 P2 — Acompanhamento com consentimento por origem

## Autoridade

Autorização comercial geral do proprietário já concedida. **Ela não substitui o consentimento individual do destinatário.** A liberação é restrita a entregas efetivamente executadas por motoboy DFL, com telefone válido, consentimento vinculado à identidade do cliente **e à referência do pedido**, e pedido recente.

## Entregas alcançadas

- Loja: preserva envio manual existente e retirada controlada.
- Site: preserva motor próprio, assinatura S2S e suas regras de aceite.
- iFood: apenas cadastro individual e logística DFL; lotes iFood continuam sem WhatsApp automático para impedir herança de consentimento.
- 99Food e Keeta: apenas logística DFL, telefone e consentimento individual explícito.
- Entregas realizadas pela plataforma, balcão/retirada de marketplace, testes internos, cancelados, antigos, sem autorização: **bloqueadas**.

## Fluxos e segurança

Os eventos de estado usam a ponte HMAC já existente e a identidade idempotente do pedido. O link inicial utiliza a reserva durável R70, token transitório nunca persistido, validade obrigatória de **90 minutos**, sessão de 30 minutos e acompanhamento verificado por dados do servidor. Resultado `accepted_by_provider` **não prova entrega/recebimento** no WhatsApp. Resultado incerto permanece isolado, sem nova tentativa automática.

**Importante:** Firestore `tracking_capabilities_v1/{tenant}.eligible_origins` precisa conter individualmente `ifood`, `food99` e `keeta` para liberar cada uma; não basta habilitar `manual`. Flags/Secrets existentes em Site e Entregas também continuam como pré-requisitos. Este pacote **não modifica infraestrutura de produção** e não altera valores remotos sozinho. Para verificar flags, usar diagnósticos owner-only e um pedido consentido real por origem.

## Pendência conscientemente separada

A UI de reenvio individual de mensagens do Site já existe para a coleção comercial `Pedidos`; isso **não autoriza** usar o mesmo endpoint para eventos de marketplaces na coleção logística. É necessária uma API dedicada com prova de falha definitiva na origem da outbox (Supabase), e não só um botão no Entregas. Não realizar reenvio quando a entrega é incerta. A limpeza de centenas de problemas antigos do lint Site também fica fora deste pacote.

## Publicação

P1 Site + Entregas devem estar na main antes da instalação. `APLICAR-VALIDAR.sh` verifica âncoras **antes de escrever**, backup seletivo e gates existentes; sem commit/push. `PUBLICAR.sh` executa novo gate, confere hash aprovado e faz stage exato no Entregas. Nenhum código Site é modificado nesta P2; o portal P1 já possui identidade visual por origem. Após publicar, conferir deploy READY no Vercel e teste real com consentimento, sem envios fictícios para clientes.
