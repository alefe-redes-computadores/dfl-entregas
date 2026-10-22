# DFL V111 R49 — Operação global e gate sem liberação

Base: R48 aprovada no Termux, não enviada ao GitHub.

## Rotas
- Primeiro filtra, ordena e classifica todas as rotas para manter totais e filtros.
- Só os cards exibidos em lotes de 40 calculam agrupamento físico e valores financeiros.
- Cada parada pode conter vários pedidos. Não mistura o valor econômico com o valor pendente; a conclusão logística não implica pagamento.
- Barra de progresso com semântica acessível.

## Compras
- O formulário guarda `purchaseSubmitLock` sincronamente antes de persistir, protegendo contra duplo toque rápido.
- Lock liberado só quando a gravação falha; em sucesso permanece até navegar.
- A proteção de interface NÃO é garantia de idempotência distribuída no Firestore/repositório e não modifica saldos, estoque ou fornecedores.
- Validação de quantidades de todos os itens selecionados continua antes da persistência.

## Equipe
- Inventário informativo atualizado; quatro perfis preservados.
- UID via Google, solicitações e homologação permanecem preparados, sem ativação.
- Firestore Emulator real e revisão de Rules candidatas ainda necessários para teste operacional com terceiros.
- Nenhum deploy, push, commit, ativação, Rule deploy ou flag alterada.

## Checklist de homologação de equipe (pendente)
1. Executar Action manual `dfl-r44-two-gates-emulator.yml` em projeto demo depois da publicação **autorizada** do lote no repositório.
2. Confirmar bloqueio owner-only atual e isolamento de motoboy, compras, operação e personalizado nas regras candidatas.
3. Revisar prova de vínculo Google, revogação imediata, cache/offline e sessão autenticada.
4. Somente depois aprovar domínio, regras de produção específicas e flags com autorização explícita; testar primeiro com dados de demonstração.
