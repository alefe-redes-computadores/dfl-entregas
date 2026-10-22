# DFL Entregas V111 R29 — Prontidão para equipe

## Propósito
Central de preflight manual e exclusivamente de leitura do superadministrador. **Não ativa**, não desativa, não modifica regras e não grava dados de clientes, entregas ou estoque.

## O que o painel examina
- Até 30 contas em `staff_accounts` e até 100 solicitações em `staff_operation_requests`; dados podem não ter ordem temporal.
- Por conta, amostra de no máximo um documento de cada uma das 5 projeções do próprio UID (máximo 150 pequenas consultas, se houver 30 contas).
- Alertas: conta active antes da homologação, status/UID incorreto, perfil inválido, permissões administrativas ou cruzadas, motoboy sem vínculo e projeções não preparadas nas últimas 24 horas.
- Flags do servidor e isolamento de origem configurado; **flag configurada não equivale à autorização efetiva**.
- Sem `onSnapshot`, `setInterval`, polling, atualização automática nem leituras pelo store global de funcionário.

## Limites importantes
- O painel NÃO acessa regras publicadas no Firebase Console; nem comprova que a Action de emulator passou. Estas verificações continuam manuais.
- Amostras não provam que todas as projeções estejam atualizadas ou livres de campos indevidos. A whitelist de projeção da R23 continua sendo a autoridade de campos.
- O painel só observa presença de documentos em cinco coleções projetadas, não lê seus dados para o cliente.
- Uma conta com `status=active` é tratada como **alerta**, nunca como autorização.
- Reprojetar é um ato administrativo via `Mais > Equipe e permissões > Homologar`, onde UID Google e hash de rascunho são verificados novamente; status segue suspenso.
- Não permite concluir entregas, alterar estoque ou aplicar solicitação. As flags R27/R28 continuam desligadas.

## Instalação
R29 requer R27 e R28 locais ainda sem commit sobre HEAD `4a469b8f905e64261b252d9f867d1c56a3570239`. Instalação sem push/commit/deploy, mantém regras owner-only e APK sem funcionário. 147 suítes PRE-APK previstas.

## Próximos gates
R30: revisão das projeções, procedimentos de conta Google isolada, testes E2E e plano de ativação controlada — sem publicar Firestore Rules sem aprovação do proprietário.
