# DFL 360 — R75 P1 (Entregas)

A Central de Mensageria agora consulta, sob demanda e somente para superadmin, a fila real de mensagens manuais da Evolution registrada no Supabase via uma ponte assinada com o Site.

## Casos
- **sent**: aceito pelo provedor; não comprova entrega/leitura.
- **pending**: aguardando worker; tentativa controlada existente pode ocorrer.
- **processing**: resultado ainda não determinado.
- **dead_letter**: exige revisão manual, nunca retry ou replay automático.
- **failed** e desconhecidos: revisão; nenhuma ação de envio adicionada.
- Retirada sem confirmação: mensagem retida; não reativar evento antigo sem evidência independente.
- Link com `delivery_uncertain`: não se confunde com mensagem normal. Verificar tracking separadamente; 90 minutos e privacidade preservados.

## Segurança
Firebase superadmin antes de consultar; pedido deve existir em Firestore. HMAC Entregas->Site com segredo já instalado. Endpoint HTTPS e host allowlisted. Validadores de resposta rejeitam campos privados. Sem listagem de outros pedidos, sem novos secrets, sem mudanças de Supabase. Consulta manual, sem polling, sem escritas, sem novos botões de reenviar.

## Próxima etapa (R75 P2)
Recuperação individual apenas após provar que não houve aceite no provedor e validar estado atual/consentimento. Eventos `dead_letter` incertos e links privados não devem ser reapresentados como pendentes nem reenviados às cegas. Prova insuficiente => revisão/contato manual, não replay.
