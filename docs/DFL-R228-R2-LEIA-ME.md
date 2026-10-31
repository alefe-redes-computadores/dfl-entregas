# DFL Entregas — R228-R2 | Cirurgia consolidada

## Por que esta versão existe
A R228 original parou na verificação sintática de `store/useAppStore.ts` e executou rollback seletivo. A suíte usou `ts.ScriptKind.TSX` em um `.ts` que contém `const incrementalCollection = <T>(...)`, causando falso erro de JSX. A R2 escolhe `ts.ScriptKind.TS` para `.ts` e `TSX` para `.tsx`, mantendo a exigência de zero erros. O TypeScript completo (`tsc --noEmit`) e o PRE-APK integral continuam obrigatórios.

## Cadastro de entrega — seleção de rota
- Considera apenas as rotas abertas do dia na tela original.
- Uma **única rota montando** prevalece sobre última rota lembrada, mesmo quando essa última já saiu.
- Com várias rotas montando, respeita preferência salva somente se ela também estiver montando. Caso contrário exige escolha explícita.
- Se **todas as rotas já saíram**, não marca uma automaticamente: permite selecionar uma delas conscientemente.
- A escolha manual e o vínculo de pedido adicionado à mesma parada são preservados.
- Mostra rótulos `Montando`/`Na rua` no seletor e avisa quando uma rota despachada é escolhida.
- Nunca altera a rota de pedidos já gravados, nem a lógica de 99Food entregue pela plataforma.

## Cards compactos
- Ajusta a faixa lateral de origem à altura do conteúdo (sem vazio após badges fixos).
- Distribui os botões de forma elástica no espaço disponível e quebra para outra linha em telas pequenas.
- Mantém todas as ações e seus handlers: dar baixa, copiar, chamar cliente, editar, reordenar e expandir.
- Não muda a lógica de agrupamento de pedidos ou o conteúdo de origem.

## Escopo conjunto
Inclui o pacote completo da R228 original: aviso Site imediato/guardado por idade/cache; estoque conservador; picker amigável ao teclado; radar compacto; feedback de rotas. Adds quatro arquivos novos na R2: política de rotas, teste de contrato, documento de revisão e patch offline.

## Segurança
- Partida fixa na R227 (`5b34fc4ff5bc78c46e747688f100e342ee018dcc`), remoto e local coerentes.
- Working tree limpa; SHA256 dos payloads; âncoras estritas; backup seletivo e rollback em falha.
- Gates novos+antigos, tsc sem emissão, PRE-APK inteiro, git diff --check, stage por allowlist.
- Publicação automática na main somente após todos os gates; nunca force ou add -A.
- Não faz deploy de regras Firebase, nem altera pagamentos, banco, dados de clientes e pedidos existentes.

## Smoke test pós-APK
1. Com rota na rua e outra montando, abrir Nova Entrega: a montando deve vir marcada; a rua só se selecionada.
2. Com duas montando, a preferência salva montando pode ser priorizada; com preferência na rua, exigir escolha.
3. Com só rota na rua, deixar vazia e mostrar aviso até toque explícito.
4. Testar nova entrega na mesma parada e conferir que a rota de origem é mantida.
5. Comparar cards SITE, iFood, 99Food, Loja, diferentes quantidades de ações; não deve sobrar faixa horizontal vazia.
6. Conferir todos os botões, rolagem, teclado Android, estoque e reconexão Site.

Observação: o filtro de atraso de notificações do Site só estará plenamente correto quando o DFL Site transmitir o timestamp de criação comercial original; o prompt separado `PROMPT-DFL-SITE-R228.md` continua no pacote.
