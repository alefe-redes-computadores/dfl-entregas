# DFL Entregas V111 — R52 · Diagnóstico e notificações resilientes

## Auditoria de impacto

- **Notificações Android**: as atualizações de expediente e lembrete de rota usam uma fila por proprietário da notificação (`shift` / `route-reminder`), com última geração prevalecendo. Uma atualização que desativa alertas cancela lembretes antigos mesmo que o agendamento anterior estivesse em andamento. Alertas imediatos não entram na fila.
- **Diagnóstico local**: o histórico em `localStorage` passa por validação de datas, status, IDs, contadores e coleção. Registros quebrados são descartados, e o histórico permanece limitado a 30 eventos. Sem nova consulta ao Firestore.
- **Diagnóstico remoto do Site**: consultas e reprocessamentos são protegidos contra cliques simultâneos. Resposta de conta Google anterior não substitui a visualização atual. O texto do diagnóstico distingue retorno do Site de entrega de WhatsApp; nenhuma entrega de mensagem é inferida.
- **Datas**: agendamentos/retornos sem timestamp válido exibem "Data indisponível" em vez de quebrar a tela.

## Limites deliberados

- A serialização de notificações é local ao processo do aplicativo, não é uma garantia entre diferentes dispositivos nem de entrega do Android.
- O histórico armazenado não mede leituras faturadas; números representam documentos retornados e registros locais.
- Nenhum banco, saldo, rota, pedido, compra, flag, perfil ou regra de produção é alterado.
- Equipe e Permissões permanece no estágio de preparação, sem acesso real de funcionários.
- O Firebase Emulator não é executado no instalador local.

## Validação

`node scripts/verify-v111-r52-global-reliability.cjs`
`node scripts/test-v111-r52-reliability.cjs`
`node scripts/pre-apk.cjs`
`node node_modules/typescript/bin/tsc --noEmit`

As duas últimas etapas são obrigatórias no instalador Termux. Publicação requer autorização explícita separada.
