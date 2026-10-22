# DFL Entregas V111 R32 — Auditoria de Projeções e Prontidão Premium

## Quatro frentes integradas

1. **Amostras sensíveis** — o servidor inspeciona no máximo um documento por área autorizada de cada UID amostrado, sinalizando campos inesperados, textos inválidos e padrões de e-mail, telefones, documentos e preços. **Não expõe o texto dos documentos suspeitos no retorno**; envia somente códigos de risco por área.
2. **Menos leituras** — consultas de projeção somente para áreas que constam das permissões da conta; limites existentes de 30 contas e 100 solicitações permanecem. Não introduz listeners, timers, paginação disfarçada ou polling.
3. **Prontidão utilizável** — indicadores separados para alertas de contas e projeções, filtro Todas / Com alertas, estados vazios claros, respostas antigas invalidadas durante refresh e orientação para revisão.
4. **Auditoria premium** — atalhos entre prontidão, solicitações, homologação e revogação sem novos botões nativos ou alteração de APIs operacionais.

## Limites e segurança

- Detector é **heurístico**: não garante anonimização ou ausência de informação confidencial. Falsos positivos/negativos são possíveis; uma amostra vazia não significa que toda a coleção esteja vazia.
- A API permanece somente leitura, com validação do token de proprietário pelo Firebase Admin SDK. A resposta não revela valores de documentos analisados.
- **NENHUMA** flag de funcionários, rota, compra, Firestore Rules, migração ou permissão foi alterada.
- Não ativar funcionários automaticamente após o PRE-APK. A política R26 foi validada em emulador, mas a regra de produção deve seguir OWNER-ONLY até processo explícito de homologação e ativação.
- A próxima fase deve incluir revalidação da projeção *no momento da publicação*, verificação de abrangência e testes de acesso com UID de homologação.
