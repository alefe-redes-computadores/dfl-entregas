# DFL Entregas — R235 Assistente Contextual Multitela

Base exigida: `76c6fe7920954c679a67b56ca7aed788b47188a9` (R234 publicada, `main`).

## O que entra
- **Rotas:** insight baseado nos contadores reais do dia (prontas, montagem, rua) com ação que reaproveita os filtros existentes.
- **Estoque:** itens zerados, abaixo do mínimo e compras abertas, usando a classificação e o estado já existentes; sem gerar quantidades, projeções ou compras.
- **Caixa de Entrada:** análise conservadora da projeção do Site e dos rascunhos manuais (revisão, duplicados, liberados); ações apenas mudam aba/filtro.
- **Montar compra:** seleção com quantidade inválida, checklist ainda não marcado e sugestões existentes; o assistente só navega dentro da interface.
- **Busca 360:** `buscar bacon na compra` abre `/estoque/compras?q=bacon` e aplica a pesquisa na lista completa, incluindo itens fora das sugestões.
- **Insights:** um por tela, dispensável para o dia por meio do armazenamento já utilizado pela aplicação; ao dispensar, pode aparecer outra sugestão útil.

## Garantias
- Não há IA remota, novos listeners do Firestore, mutações automáticas, sincronização adicional ou alterações de regras Firebase.
- R234 e seu Radar antigo ficam preservados.
- Nenhum acerto, pagamento, conclusão, alteração de estoque, reserva ou compra é executado pelo assistente.
- Dados de contagem são os mesmos que as páginas exibem; se não houver sinais úteis, o componente não ocupa espaço.
- Animações e voz deliberadamente reservadas para cirurgias posteriores (R236/R237).

## Segurança de instalação

Instalador com pré-verificação do branch/HEAD/remote, árvore limpa, SHA256, 11 âncoras, backup tar seletivo, testes R235/R234, TypeScript, PRE-APK integral, allowlist explícita, `git add` seletivo, commit e push **somente** quando todas as validações passam. Reprovação anterior ao commit gera rollback seletivo. Após commit, nenhum reset automático.

## Teste manual após publicação

1. Home: Busca 360 → `buscar bacon na compra` → compra com `bacon` preenchido e itens completos disponíveis.
2. Rotas: com rotas prontas/montando, tocar no insight e confirmar filtro (sem iniciar/fechar rota).
3. Estoque: com zero ou baixo, conferir filtro local e lista, sem alterar saldos.
4. Caixa: acionar insight com pedidos do Site ou importações em revisão e conferir se só mudou aba/filtro.
5. Compras: alterar rascunho, conferir sugestão de quantidade inválida/checklist e confirmar que nada foi gravado como compra automaticamente.
6. Voltar para Home e testar que a Busca 360 e o Radar recolhido da R234 seguem disponíveis.

APK Android: conferir Action específica e gerar/instalar separadamente após a publicação.
