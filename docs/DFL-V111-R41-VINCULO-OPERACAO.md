# DFL V111 R41 — Identidade por solicitação + desempenho de listas

## Mudanças
- Funcionário autenticado no Google pode **pedir vínculo** quando seu e-mail verificado já aparece em um rascunho elegível.
- **Não** precisa copiar UID manualmente: o owner abre `Mais → Equipe → Homologar Google`, seleciona o rascunho e consulta pedidos; escolher pedido preenche UID. O fluxo **verificar → prévia → preparar SUSPENSO** da R23 continua intacto.
- A API recebe **token Firebase revogado-verificado**, consulta usuário real no Firebase Authentication (provedor `google.com`), exige email verificado, status de rascunho, vínculo motoboy e origem HTTPS isolada. Não usa UID/e-mail enviados no corpo. Não devolve os rascunhos ao funcionário.
- Gate duplo, **DESLIGADO por padrão**: `NEXT_PUBLIC_DFL_STAFF_LINK_REQUEST_ENABLED=true` (interface, build separado da equipe) e `DFL_STAFF_LINK_REQUESTS_ENABLED=true` (servidor, nunca no cliente). A segurança também exige `NEXT_PUBLIC_DFL_STAFF_ORIGIN` e `NEXT_PUBLIC_DFL_OWNER_ORIGIN` válidas e distintas. Nunca reusar mesma origem/sessão do owner.
- `staff_link_requests/{uid}` é indexado pelo UID verificado. Pedido reaproveitado por dois minutos; sem polling. A consulta owner é sob demanda, limitada a dez.
- Motoboy não acessa dados reais com este pedido: `staff_accounts` permanece `suspended`, regras Firestore continuam owner-only e `NEXT_PUBLIC_DFL_STAFF_PORTAL_ENABLED` continua desabilitada.
- Entregas: não normalizar telefone/endereço etc quando o filtro de busca está vazio; ordenar timestamp calculado uma vez por pedido.
- Rotas: data de ordenação calculada uma vez por rota e fallback seguro para datas inválidas.

## Homologação segura
1. Cadastrar e-mail real e vínculo com motoboy em `Equipe e permissões`. Sem liberar role financeira.
2. Em ambiente de **homologação HTTPS isolado**, configurar manualmente flags de solicitação, **sem ativar portal/Rules**.
3. Motoboy entra pelo Google verificado, vê estado bloqueado, escolhe **Solicitar vínculo**.
4. Owner abre **Homologar Google**, consulta pedido e o seleciona. Valida UID/e-mail, calcula prévia, prepara conta **suspensa**.
5. Para teste de operação **real** (consultar minhas rotas), ainda serão necessárias Rules com isolamento testadas no Firebase Emulator, autorização explícita de deploy, domínio da equipe e gate de liberação. NÃO interpretar pedido aprovado como liberação de dados.

## Segurança e performance
- Esta R41 não implanta Rules, não ativa portal e não altera nenhum dado externo.
- Não há cron, listener, polling, sync automático ou leitura de Firestore sem ação explícita.
- O owner continua único administrador e todas as escritas via Admin SDK exigem token verificado.
- Limite por requisição, redução de exposição de dados e CORS com origem exata.
