# DFL Entregas — R55 / Fechamento premium de Home e Loja

## Base e rastreabilidade

- A R55 só é aplicável depois da R54-R4 ter sido validada localmente (selo `R54-ULTIMA-VALIDADA.txt` e SHA256 de todos os arquivos); a R54 foi informada pelo operador como aprovada em 349 suítes.
- A R55 audita `main` local versus `origin/main`; nenhum serviço externo, mensageria, Firestore ou Supabase é alterado.
- Não cria novos sistemas de notificações nem de atualização: preserva as centrais P360 já existentes. As páginas Mais e Preferências permanecem na versão R54 aprovada.

## Escopo de alterações

1. **Home:** as rotas em andamento são apresentadas antes da lista longa de retiradas e balcão. A Busca 360 e a leitura auxiliar continuam disponíveis em expansão, mas não interrompem a operação principal. O bloco de resumo preserva faturamento, privacidade e atalhos de data.
2. **Pulso operacional:** `OperationReadiness` e `RouteCashPulse` passam a aparecer também quando há rotas abertas, mas nenhuma ação urgente foi gerada. O ramo com prioridades permanece o original; não há renderização duplicada no mesmo estado.
3. **Estados vazios:** uma operação com somente balcão ou retirada não ganha aviso enganoso de dia totalmente vazio.
4. **Loja:** o atalho de horário semanal aparece junto do botão real de abrir/fechar. Ele reutiliza o editor canônico (e não grava nada no clique). O resumo das preferências fica recolhido sob demanda e os acentos de horário/salvamento passam a seguir o esmeralda do Entregas.
5. **Funcionalidades preservadas:** SiteAdminHub, Caixa, Site, histórico, rotas, entregas, equipe, motoboys, clientes, compras, estoque, despesas, dias e feriados, loja manual/automática, relatórios, notificações, atualizações Android, mensageria e acompanhamento.

## Contratos de regressão

- R54 e R55 dirigidos, TypeScript, ESLint executado diretamente sem o assistente `next lint`, e todas as 349 suítes do `scripts/pre-apk.cjs`.
- `git diff --check`, integridade SHA256, Git stage seletivo exato de **nove arquivos** (cinco rastreados + quatro novos, incluindo duas cirurgias).
- Falha de gate restaura **somente arquivos da R55**, preservando R54 aprovada. Sem commit ou push.
- Após todos os gates, o script verifica novamente origem, integridade, stage exato e faz **um commit contendo R54 + R55**, seguido de push `main`. O APK continua dependente do GitHub Actions, instalação e avaliação visual no Android.
- Se o push falhar depois do commit, o commit local é preservado; nenhum reset forçado.

## Limites

A validação de código **não substitui inspeção visual no APK**. Conferir especialmente scroll, área segura, retorno do editor de horário, preferências, cards financeiros e links. Nenhuma nova configuração de bot, NEXT_STOP ou WhatsApp é ativada pela R55.
