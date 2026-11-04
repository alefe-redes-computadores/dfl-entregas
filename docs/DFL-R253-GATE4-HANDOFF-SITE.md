# DFL Entregas ↔ DFL Site — R253 Gate 4, homologação sem ativação

**Referências:** Entregas `fe3076f95cbe68cab21419c490cd6b1d15250387` (R252); Site `ee716ca5c798d6cb5dd757f769798e4d2faaf8f4` (auditado em 04/11/2026). Estas versões são ponto de partida documental, não uma promessa de que o Site já implementou `/acompanhar`.

**Escopo da R253:** backend Entregas, somente owner, leitura. A página pública e a sessão HttpOnly são responsabilidades do Site. Nenhuma configuração, permissão, coleção, regra Firestore, token ou mensagem é alterada por este pacote.

## Estado operacional e limites

- R249: contratos A–E, ledger, emissão/revogação, autorização e projeção pública, condicionados a flags e tenant.
- R250: Central de Acompanhamento, inspeção confirmada por pedido e compatibilidade Capacitor.
- R251: cenários fictícios, certificação por pedido A–E, rejeição de projeções públicas incorretas.
- R252: auditoria owner-only em lotes de até 20 pedidos, sem nomes/endereços/valores no relatório compartilhável.
- R253: **Ponte com Site**: diagnóstico administrativo seguro, contrato de assinatura HMAC para endpoints de `exchange` e `status`, validação de sessões/respostas no consumo Site, testes de rejeição e instruções de integração.

**ATENÇÃO:** A R253 não implica certificado de comunicação real entre servidores. Para emitir qualquer link/abrir consulta pública, exige homologação conjunta específica e habilitação intencional de políticas e segredos no backend. Não há ativação automática. Não configurar flags em produção por causa deste pacote.

## Endpoint administrativo novo, somente leitura

`GET /api/integration/tracking/v1/admin/handoff`

- `Authorization: Bearer <Firebase ID token do proprietário>`; autenticação obrigatória com revogação checada no servidor.
- `Cache-Control: no-store`, `Referrer-Policy: no-referrer`; CORS somente nas origens nativas já autorizadas do Capacitor.
- Retorna `{"ok":true,"report":{"contract":"dfl.tracking.gate4.handoff","version":1,...}}`.
- Exibe somente flags booleanas e estado agregados; não retorna tenant ID, key IDs, token, nomes, cliente, pedido, valores, conta ou segredos.
- Não executa transação, nova gravação, scan de entregas, intenção de mensagem ou chamada ao Site.
- 403 acesso negado, 503 falha de configuração/leitura. Respostas de erro genéricas.
- Somente a tela **Mais → Central de Acompanhamento → Ponte com Site** consome esse diagnóstico, mediante toque explícito.

## Envelope de assinatura entre servidores

**Nunca executar os exemplos com tokens reais em chat, log ou URL.** Requisições entre os backends são POST com corpo JSON, sempre HTTPS. Não enviar o token ao navegador em resposta de status.

### Troca de token

`POST /api/integration/tracking/v1/authorize`

```json
{"contract":"dfl.tracking.access","version":1,"action":"exchange","opaque_token":"<TOKEN_OPACO_DE_43_CARACTERES>"}
```

### Consulta de sessão

`POST /api/integration/tracking/v1/status`

```json
{"contract":"dfl.tracking.access","version":1,"action":"status","scope_handle":"<HANDLE_OPACO_DA_SESSAO>"}
```

### Cabeçalhos assinados

- `x-dfl-tracking-timestamp`: UTC ISO8601; tolerância operacional atual de 120 segundos.
- `x-dfl-tracking-nonce`: valor único por requisição (base64url, ao menos 20 caracteres).
- `x-dfl-tracking-kid`: ID de chave ativa configurada nos dois backends.
- `x-dfl-tracking-signature`: HMAC-SHA256 minúsculo de `POST\n<path>\n<sha256-do-corpo>\n<timestamp>\n<nonce>\n<kid>\n<tenant>`.

O corpo enviado **deve ser exatamente o corpo assinado**. O backend Entregas compara a assinatura em tempo seguro, verifica timestamp e usa nonce único persistido para bloquear replay. O código referencial de montagem está em `lib/tracking/gate4/site-wire.ts` do Entregas; pode ser portado para a biblioteca server-only do Site depois de revisão do código da versão publicada.

O cliente Site não deve aceitar redirecionamento de HTTP, não deve cachear nem repetir automaticamente uma troca de token. Não guardar token, handle ou assinatura em logs/analytics. A autenticação S2S deve usar segredos próprios, não a service account do Firebase.

## Contrato B: corpo de status

Resposta 200 do Entregas: JSON validado pelo contrato **`dfl.tracking.public` versão 1** (nome lógico `dfl.tracking.public.v1`). Campos fechados; o Site não deve reinterpretar estado comercial a partir de eventos de logística. O Site deve validar a resposta **antes** de renderizar, inclusive ausência de campos financeiros/administrativos e validade de datas.

Qualquer erro 401/403/404/429/5xx, JSON inválido, resposta incompatível ou rede indisponível deve **limpar os dados exibidos da sessão**, sem mostrar estado armazenado previamente como se fosse atual. A política de consumo está em `lib/tracking/gate4/site-contract.ts`.

Revogação de sessão deve ser efetiva em cada consulta ao Entregas. O cookie HttpOnly restrito, cookie scope/path, remoção do fragmento `#t=` e proteção anti-CSRF/abuso da troca pertencem à implementação do Site.

## Variáveis de ambiente: nomes, não valores

**No Entregas:** `DFL_TRACKING_GATE1_ACTIVE`, `DFL_TRACKING_CUSTOMER_ACCESS_CERTIFIED`, `DFL_TRACKING_TENANT_ID`, `DFL_TRACKING_S2S_KEYS_JSON`, `DFL_TRACKING_LEGACY_TENANT_ID` (apenas quando homologada a compatibilidade de dados legados). Flags de empresa permanecem no contrato `tracking_capabilities_v1` e devem continuar OFF.

**No Site (nomes candidatos, acordar antes de usar):** `DFL_TRACKING_ENTREGAS_BASE_URL`, `DFL_TRACKING_S2S_KID`, `DFL_TRACKING_S2S_SECRET`, `DFL_TRACKING_TENANT_ID`, `DFL_TRACKING_PUBLIC_SESSION_SECRET`. Nunca expor segredos com `NEXT_PUBLIC_*`.

Não mover segredos entre projetos por arquivos de exemplo, relatórios, chat ou APK. A troca de valores reais deve seguir o gestor de secrets de cada servidor.

## Matriz de homologação conjunta

1. Autorização administrativa isolada: proprietário 200; usuário comum 403; sem login 403.
2. Flags ausentes ou inválidas não habilitam cliente nem emissão de links.
3. Requisição Site válida: HMAC certo, timestamp novo, tenant correto, nonce único.
4. HMAC errado, corpo modificado, caminho trocado, tenant errado, nonce repetido e timestamp vencido: bloqueio.
5. Cliente A nunca acessa o pedido B, inclusive pela substituição de scope handle.
6. Token expirado/revogado falha. Cookie previamente emitido perde autorização após revogar grant.
7. Status recebido não representa aceite; alocação não representa despacho; encerramento de rota não entrega pedido.
8. Reordenação e reconciliação ocultam posição incerta; sem GPS/ETA fictícios.
9. Nomes, telefones, endereços de terceiros, valores, IDs administrativos e tokens ausentes da resposta pública.
10. Serviço indisponível: Site limpa o estado, preservando checkout e operação Entregas.
11. Testes Android/PWA, teclado, safe-area, botão Voltar, rolagem e atualização na página.
12. Nenhuma mensagem ou link real em ambiente de teste.

A aprovação do Gate 4 documental/local **não** é o Gate de ativação pública. O próximo checkpoint é o Site implementar `/acompanhar` e os dois projetos rodarem juntos a homologação.
