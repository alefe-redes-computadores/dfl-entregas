# DFL Entregas — V100.6: fechamento operacional antes do release

## Escopo efetivamente aplicado

- Fechamento de rota verifica os IDs vinculados no servidor e, dentro da transação Firestore, verifica estado real de cada entrega antes de alterar a rota. Isso evita finalizar uma rota com confirmação local desatualizada.
- Reabertura confere o status remoto e preserva o horário histórico do primeiro fechamento.
- Fila iFood: atualização de confirmações existentes ocorre com leitura transacional. Uma confirmação `resolved` no servidor não é reativada pelo processamento automático posterior da rota. Confirmação manual segue sendo uma ação explícita da Central.
- Edição/exclusão de despesas verificam se o registro no servidor é um acerto fechado, preservando a imutabilidade mesmo se o dispositivo tiver cópia local antiga.
- Falha do feedback tátil da Central de Confirmações não interrompe confirmação nem navegação.

## Limites e decisões de arquitetura

- Leituras extras ocorrem SOMENTE na ação de fechar/reabrir rota, atualizar fila ou editar/excluir despesa. Não foram criados listeners, polling ou leituras no render.
- A verificação de IDs de entregas é feita imediatamente antes da transação; um novo vínculo criado por outra sessão exatamente entre a consulta e o commit ainda depende de controles de escrita do aplicativo/regras Firestore. Não declarar serialização global absoluta.
- A deduplicação remota nesta versão protege o mesmo ID persistido. Pedidos manuais com IDs diferentes exigem política de chave canônica caso seja necessário garantir deduplicação entre aparelhos.
- Concluir a rota **não** confirma pedidos no portal do iFood: o estado externo permanece separado da conclusão operacional.
- Firestore Rules em produção não são auditáveis a partir do repositório; a última regra compartilhada estava aberta. É bloqueador para aprovação de segurança. NÃO alterar regras sem mapear as coleções/identidade e o projeto Site separadamente.
- O PRE-APK é uma bateria de contratos e cenários unitários; não é teste end-to-end real em dispositivos concorrentes. O TypeScript completo e testes no Android fazem parte do gate do instalador.

## Checklist de release (a executar depois da validação V100.6)

1. Regras do Firestore auditadas e aprovadas sem `allow read, write: if true`.
2. Git auditado por diff/staging seletivo. Não usar `git add .`.
3. Conferir cenário simultâneo: aparelho A conclui iFood; aparelho B fecha rota; status permanece `resolved`.
4. Conferir entrega agrupada, reabertura, entrega cancelada no site, rota com alteração remota e acerto fechado.
5. Conferir APK nativo com localização e permissões após novo build, e Site separado.
6. Somente após aprovação explícita, fazer commit/push/deploy e comparar versão final com release.
