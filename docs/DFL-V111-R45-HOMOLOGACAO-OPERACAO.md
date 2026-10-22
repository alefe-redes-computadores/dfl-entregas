# DFL V111 R45 — Operação global + segurança de homologação

## Áreas
- Pedidos/Rotas/Clientes: listas exibem até 40 cards inicialmente e permitem carregar outros 40.
- Filtros, buscas, totais, ranking, consistência e ações continuam operando sobre coleções completas já existentes no store. Nenhum Firestore query foi adicionado.
- Equipe/Homologar: respostas de verificação anteriores não podem validar visualmente seleção alterada; consultas de solicitações antigas não sobrescrevem seleção nova.
- Portão de liberação: inventário histórico ampliado e explicitamente informativo.

## Limites da entrega
- Acesso real de funcionários permanece indisponível; homologação com Firebase Emulator real e revisão das Rules publicadas continuam obrigatórias.
- Nenhum commit, push, deploy, migração, Rules ou flags alterados.
- Listas progressivas reduzem custo inicial de renderização, não substituem paginação de backend e não reduzem leituras Firestore.
- PRE-APK: 170 -> 172 suites.
