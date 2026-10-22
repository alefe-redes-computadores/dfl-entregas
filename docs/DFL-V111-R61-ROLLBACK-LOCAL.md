# DFL V111 — R61: rollback otimista sem perda de registros paralelos

## Escopo

- Estoque: cadastro e edição de produto, incluindo movimentação inicial via batch.
- Compras: erro ao excluir compra pendente restaura somente a compra, sem desfazer outra alteração.
- Fornecedores: cadastro, edição e arquivamento protegido contra duplo toque.
- Equipe administrativa: cadastro e edição de integrantes preservam registros concorrentes. **Isto não ativa usuários nem altera o portal de staff.**

## Regra

O rollback só desfaz a versão otimista da entidade se a referência ainda corresponde à tentativa que falhou. Se uma atualização posterior ou sincronização substituiu essa entidade, a UI não sobrescreve o dado mais novo. Coleções diferentes e outras entidades não são restauradas a partir de snapshots antigos.

## Limites

- Esta proteção é **local** à instância JavaScript: não substitui transações ou serialização por entidade entre dispositivos.
- Em caso de falha parcial de rede, a confirmação e a origem de verdade continuam no Firestore; o aplicativo deve sincronizar antes de novas ações conflitantes.
- A remoção de uma compra mantém as regras de bloqueio de estoque já integrado.
- Nenhum saldo de estoque, acerto financeiro, permissão ou Rules são alterados por esta cirurgia.

## Homologação

- Verificações R61: estrutura das mutações e ~16 mil verificações comportamentais do rollback.
- TypeScript e PRE-APK integrados (204 suítes) obrigatórios no instalador Termux.
- Sem commit, push, deploy, migração, Rules ou ativação de funcionário.
