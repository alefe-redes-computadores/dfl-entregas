# DFL Entregas V111 R65 — Estabilidade de abertura

## Escopo e não escopo

Correções locais focadas no expediente. **Não há publicação, migração, Rules novas, alteração financeira nem ativação da Equipe.**

1. A conferência da Home usa a mesma agenda operacional da Loja (`operationalDaySchedule`): escala semanal, pausas e exceções locais para feriados. Não depende do fuso escolhido pelo aparelho.
2. Pausas antigas sem data final são tratadas como um único dia. Pausas malformadas são ignoradas na avaliação e não causam exceção no aplicativo.
3. O botão **Abrir** utiliza uma trava síncrona por instância para evitar toques duplicados. Falha do armazenamento local do WebView não é confundida com falha na gravação do Firebase.
4. Com dados **já carregados na memória**, a conferência mostra entregas de hoje sem endereço para revisar. Ignora cancelamentos do Site, retiradas/balcão e agendamentos futuros; não bloqueia a abertura. Nenhuma consulta extra é executada.
5. O worker não grava checkpoint de recuperação como concluído se o tamanho de lote, contagem lida ou IDs estiverem inconsistentes.
6. A decisão do reverse-drain rejeita resultados malformados, sem aceitar números representados como strings.

## Homologação no turno

- Loja com agenda normal: conferir aviso de abertura na Home.
- Loja com exceção para operar em dia normalmente fechado: a conferência deve estar disponível.
- Pausa/feriado fechado: não sugerir abertura por engano.
- Com saldo de estoque em atenção, confirmar aviso. Aviso de endereço leva a Entregas sem alterar nenhum pedido.
- Abrir com um único toque; verificar que o estado da Loja corresponde ao Firebase e ao Site. Isso exige inspeção do ambiente real: os testes locais não garantem entrega de mensagens externas.
- Confirmar manualmente integração de pedido de teste, rota, pagamento e fechamento antes de iniciar o horário de pico.

## Verificação técnica

O instalador executa `node node_modules/typescript/bin/tsc --noEmit`, os verificadores R65, `node scripts/pre-apk.cjs` e `git diff --check`. Ao falhar, executa rollback para a R64.

**Não representa autorização para funcionários.** O Emulator e a liberação real de Equipe seguem pendentes e não são executados aqui.
