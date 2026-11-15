# DFL 360 R74 P1 — Identidade das origens no acompanhamento

## Alterações entregues

- Site: mostra etiqueta premium por origem, com ícone Lucide e cor semanticamente distinta (Loja DFL, Site DFL, iFood, 99Food e Keeta), além de fallback neutro.
- Entregas: a projeção privada conhece o rótulo **Keeta**, sem alterar eventos, identidade do pedido, permissões ou o formato do contrato público.
- Gate hermético novo em ambos repositórios; no Entregas, inscrito no PRE-APK global.

## Intencionalmente fora desta P1

**Esta P1 não habilita links para marketplaces.** A autoridade de emissão no Entregas continua recusando origens sem certificação, e a política de avisos manuais continua restrita aos próprios pedidos. Nenhuma flag será alterada automaticamente. A P2 da R74 deve abordar autorização contextual para outros canais, elegibilidade assinada, histórico de consentimento, integrações Site/Entregas/WhatsApp, estado do provedor e validação das regras de cada plataforma. Não usar telefone de terceiro sem autorização documentada.

**A capacidade de retry existente no Site não foi duplicada.** A função `src/app/api/admin/messaging/retry/route.ts` exige proprietário, `DFL_MESSAGING_MANUAL_RETRY_ENABLED=true`, falha transitória e estado comercial atual; não cobre automaticamente a fila de tracking manual. A P2 deverá revisar o contrato e disponibilizar o controle unificado apenas para falhas classificadas e seguras, sem repetir token já emitido após resultado incerto.

## Homologação externa obrigatória

Conferir a configuração real de `tracking_capabilities_v1` e flags de produção, a autoridade de cada canal, a identidade do destinatário, o prazo de 90 minutos, a emissão e o recebimento por WhatsApp e a aparência no Android. A aprovação TypeScript e PRE-APK é exclusivamente local.
