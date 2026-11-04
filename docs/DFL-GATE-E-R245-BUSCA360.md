# DFL Entregas — Gate E R245 | Busca 360 Premium (escopo da R238)

Base estrita: main R237 `343df496a817cab83cd09b08a37c873c2be402eb` e R243/R244 **aplicadas localmente, não publicadas**.

## O que mudou

- Busca 360 no painel global e na Home: uma única ordenação por relevância, priorizando ID/código exato sobre correspondências parciais.
- Pesquisa por tipo: pedidos, clientes, rotas, estoque e motoboys. Resultados diretos navegam apenas para páginas existentes, com ID codificado.
- Distinção entre pessoas homônimas e pedidos diferentes; Enter nunca abre cadastro aleatório quando há empate. Detalhes mostram identificador do pedido e, quando disponível, horário registrado.
- Horário `Pedidos às 15:00`: **minuto exato**, no fuso `America/Sao_Paulo`, consultando `created_at`/`createdAt` dos dados que já estão no store. `Por volta das 15:00`: janela de 15 minutos. Não inventa data/hora quando falta o registro.
- O filtro temporal é feito no snapshot local. **Não** encaminha uma query string de horário à tela de Entregas, que não tem esse filtro implementado.
- Exemplos rotativos por abertura do painel global e por montagem da Home; não grava exemplos nem pesquisa livre em localStorage.
- Correção de envio do formulário da Home: Enter usa o texto **atual**, evitando resultado defasado pelo `useDeferredValue`.
- Paleta global com filtros por entidade, identificação do tipo de registro e altura limitada em tela mobile; mantém Escape, botão fechar, foco e movimento reduzido da R237.
- Privacidade: nenhum resultado com dados do store é exibido quando modo privacidade está ativo. Favoritos/recentes continuam somente de IDs conhecidos.

## O que ficou fora

- Não cria consulta Firestore, gravação de pedidos, API, rota, produção ou preço, movimentação de estoque ou pagamento.
- Não altera `assistant-intent.ts` e não altera filtros das telas especializadas (a navegação R234 permanece intacta).
- Não adiciona consultas reais para fornecedores, compras históricas ou pagamentos (sem contrato de dados/visualização certificado).
- **Não** declara previsão de demanda instantânea, capacidade, ETA, loja aberta/fechada ou status financeiro.
- R243/R244 permanecem locais. Combo V3 comercial, impressão física, Finance, bridge DFL 360 e WhatsApp real continuam OFF.

## Segurança e rollback

- HEAD e remoto exatamente R237; alterações locais esperadas das R243/R244, novos arquivos anteriores com SHA256 fixo.
- Allowlist de três arquivos rastreados editados por R245 (`GlobalAssistantPalette`, `OperationalAssistant`, `pre-apk.cjs`) e três arquivos novos (motor, teste e documentação).
- O quarto rastreado já modificado (`app/mais/diagnostico/page.tsx`) permanece intacto, com R243/R244.
- Backup seletivo antes de qualquer escrita, comparação exata com base R237 e PRE-APK R244 reconstruído, rollback de R245 em falha.
- Teste R245, regressões R234/R236/R237 e R242/R243/R244, TypeScript completo, PRE-APK completo (302 suítes), `git diff --check` e invariantes do stage.
- Não faz commit, push, deploy, mudança Firestore/Rules, APK nem WhatsApp.

## Homologação posterior (não automática)

Testar no APK: horário local, teclado Android aberto, voltar, lista comprida, clientes iguais, IDs repetidos entre origens, privacidade, rolagem e modo offline; sem considerar dados não sincronizados como atuais. Gate E segue **BLOQUEADO** até as demais provas requeridas.
