# DFL Entregas — R237 | Assistente Global + Fechamento Contextual Premium

**Base obrigatória:** `e652b4d0b65aab12ca5630e8544d07e4d7c07521` — R236 publicada.

## Evolução entregue

1. Busca 360 **em qualquer tela**, no cabeçalho (ícone lupa); no desktop pode usar `Ctrl/Cmd+K`. Abre um painel premium compatível com teclado, botão Voltar/Escape e movimento reduzido.
2. Busca unificada reaproveita `assistantDestinations` e `searchAssistantSnapshot`: nenhuma nova consulta do Firestore, nenhum serviço externo e nenhuma escrita de pedido. Quando abre, consome o snapshot existente do store. Quando fechada, não mantém os assinantes da busca montados.
3. Atalhos favoritos e recentes, reutilizando `useAssistantShortcuts`; persistência de IDs conhecidos apenas, sem nome de cliente, telefone ou termo digitado.
4. Inteligência contextual prioriza revisão, duplicidade, quantidade inválida e ruptura de estoque; remove a sugestão genérica de “rotas na rua” que frequentemente gastava espaço sem oferecer diagnóstico.
5. Ao dispensar um insight da Home, outra evidência acionável disponível (estoque) pode assumir, evitando um componente morto.
6. Tema escuro premium preservado, glow/entrada suave restritos ao painel, foco visível, estados de busca vazia, segurança e acessibilidade.

## Preservado

- Não altera Firestore, Rules, API, rotas transacionais, pagamentos, estoque ou fluxo de checkout.
- Não altera integração de combos do Site R242 nem homologação R232.
- O Radar legado permanece recolhido; retirada definitiva depende de teste real do APK.
- O fluxo de sincronização e navegação especializada não sofre substituição.

## Homologação

- Testes novos: `scripts/test-r237-assistant-global.cjs` (seleção, prioridade, privacidade, não escrita e parse TSX).
- Regresso R236, R235 e R234, TypeScript e PRE-APK integral.
- Allowlist de 9 arquivos, `git diff --check`, SHA256 do payload, HEAD/remoto e rollback seletivo.
- Commit/push apenas após aprovação completa. Conferir GitHub Actions APK em seguida.

## Checklist manual no APK

1. Na Home e em Estoque abrir lupa do topo; buscar nome, pedido, código e produto; navegar e retornar.
2. Testar “rotas em montagem”, “entregas pendentes”, “caixa de entrada”; sem escrita automática.
3. Teclado aberto em tela pequena, rolagem, X e voltar Android; nada pode ficar coberto pela navegação inferior.
4. Ativar privacidade: nome/telefone não devem aparecer como resultados.
5. Favoritar um atalho, fechar/reabrir; recente não armazena pesquisas livres.
6. Descartar insight de Home: outro válido aparece quando existe; nenhum insight vazio/genérico.
7. Testar sem internet e em movimento reduzido; nenhuma degradação de listagem, reordenação ou sync.

**Nota:** o pacote valida e publica código; a build Android continua precisando do resultado da GitHub Action e homologação no aparelho.
