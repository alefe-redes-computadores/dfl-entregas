# DFL Entregas R234 — Busca 360 e Radar progressivo

Base obrigatória: `0486794ff1f204bcb95a2840bd3e6934033555ed` (R233 em `main`).

## Escopo

- Home: card **DFL · Busca 360** para consulta e navegação local, sem chatbot remoto.
- Intenções reconhecidas: rotas em montagem/na rua, entregas pendentes, pagamentos a conferir, pedidos por nome/ID, compras, Caixa de Entrada, estoque baixo ou zerado.
- Resultados locais limitados a seis, a partir dos snapshots existentes de pedidos, clientes, rotas e estoque. Nenhum listener ou consulta de rede adicional.
- Preserva o modo privacidade: busca não revela pessoas ou pedidos nesse modo.
- Insight contextual somente quando há evidência real: entregas sem rota do período ou produtos abaixo do mínimo cadastrado; pode dispensar para o dia.
- Filtros da Busca 360 aplicados pelas telas de Entregas, Rotas, Estoque e rascunhos manuais da Caixa de Entrada.
- Radar legado fica **recolhido por padrão**, mas continua disponível e com seus motores intactos. Após avaliação em campo, decidir substituição definitiva.
- Operações são somente leitura/navegação: não cria, cancela, edita, conclui ou movimenta dados.
- Não adiciona IA remota, voz, novas permissões ou Firebase Rules.

## Segurança e publicação

- Preflight de **todas** as âncoras em memória, antes de qualquer modificação.
- Exige `main` limpa, HEAD/R233 exato, remoto fixo e origem sem avanço.
- Backup seletivo; rollback automático antes do commit.
- Teste R234 + TypeScript `--noEmit` + PRE-APK integral. Nenhuma suíte dispensada.
- `git add` apenas na allowlist, commit/push somente se tudo aprovar.
- Build Android e homologação física do APK devem ser conferidos separadamente.

## Fora do escopo de R234

- Comandos destrutivos ou mutações sem confirmação.
- Ditado de voz, aprendizado com dados externos, IA generativa, busca de histórico remoto.
- Remoção definitiva do Radar e polimento geral de outros componentes.
