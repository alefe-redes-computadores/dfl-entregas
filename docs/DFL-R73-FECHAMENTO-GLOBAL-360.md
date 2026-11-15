# DFL ENTREGAS — R73 · Fechamento Global Premium 360

## Escopo implementado (Entregas)

1. **Seletor Premium:** fechamento externo, Escape, retorno do foco, fechamento ao desabilitar e navegação por setas. Nenhum `select` nativo novo.
2. **Retornos:** confirmação premium com destino explicitado; impedimento de reinserção em rota sintética, fechada ou idêntica; motor `updateDelivery` e proteção do proprietário preservados.
3. **Comunicação 360:** texto sobre rollout atualizado; habilitação automática não é inferida pelo código; aceite na fila não confirma recebimento do WhatsApp.
4. **DFL Intelligence:** contagens operacionais excluem cancelados, testes, arquivados, balcão, retiradas e entrega pela plataforma; retornos aguardando reentrega são visíveis com acesso à fila existente. Sem novos listeners e sem mensagens.
5. **Mais:** atalhos técnicos sem nomes legados, preservando menus completos.
6. **Loja e estoque:** efeito de modal com dependências explícitas; botão do seletor de estoque sem aria-invalid incompatível.
7. **Regressões:** contratos R73 adicionados ao PRE-APK; auditoria estática separada, sem rede. O contrato legado R299 P8 é atualizado para verificar a permissão condicional e a ausência de confirmação falsa de entrega.

## Preservado sem modificar

- Acompanhamento Site/Entregas existente, consentimento, emissão 90 minutos já implantada no Site, primeira/próxima parada, deduplicação, Supabase, Evolution, worker e destinatários.
- Cálculo financeiro, estoque, acerto de motoboy, regra de retorno e confirmação externa iFood.
- Nenhum novo webhook, função de banco, mensagem, relatório comercial ou rotina automática.

## Limites de evidência

- PRE-APK, TS e lint comprovam apenas a integridade local do código. É necessária revisão visual no Android após deploy.
- Emissão de link (Site), suporte a URL pelo provedor, processamento da fila e recebimento no WhatsApp precisam de **evidências de produção**. `accepted_by_provider` NÃO é `delivered/read`.
- Flags efetivas do ambiente não são divulgadas pelo código e não são ativadas por este pacote.
- Antes de afirmar homologação total, consultar a central e auditar: autorização do cliente; evento único; status outbox/worker; template de mensagem com link/primeira parada; recibo do provedor; TTL 90 min e revogação; nenhum dado sensível nos logs. Não reenviar automaticamente mensagens incertas.

## Uso seguro

- `APLICAR-VALIDAR.sh`: verificação de hashes e âncoras, backup seletivo, rollback e testes completos. Não publica.
- `PUBLICAR.sh`: revalidação, stage EXATO dos arquivos listados, commit/push `main` somente depois da aprovação.
- `scripts/audit-r73-360.cjs`: auditoria estática, não acessa serviços externos.
