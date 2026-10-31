# DFL Entregas — R226 / Última milha de pré-abertura

Base obrigatória: `5a1809490d2c1c0df24ca3bf97474a300214be54` (R225-R2 na main).

## Mudanças cirúrgicas
- Modal “Sair da compra” (`app/estoque/compras`) renderizado por portal com rolagem e área segura Android.
- Modal “Compra não salva” (`StockSupplyForm`) renderizado em portal, sem perder ações de continuar, guardar rascunho ou descartar.
- Seletor/cadastro de produto (`StockProductPicker`) renderizado em portal com área segura e rolagem.
- Seletor de fornecedor (`StockSupplierPicker`) renderizado em portal, mantendo criação e bloqueio durante a gravação.
- Seletor de categoria (`StockCategoryPicker`) com altura real de viewport e safe area; portal existente preservado.
- `StockSupplyForm`: conjunto memorizado de IDs de produtos já utilizados substitui busca interna repetida por cada candidato; não muda a regra de produto único por item.
- Nova suíte R226 integrada ao pré-APK; contrato legado V92 atualizado para o novo viewport seguro sem suprimir validações; inventário visual read-only com candidatos a testar manualmente.

## Explicitamente não alterado
- Banco de dados, Firestore Rules, permissões de equipe, saldos, forma de cobrança, transações, atualizações ou exclusões operacionais.
- Motor de reconciliação/offline, fila de gravações e autoridade remota. Não há confirmação fictícia de pagamento ou estoque.
- Nenhuma migração, nenhum APK criado no aparelho.

## Gate antes de publicar
- A main deve estar exatamente na R225-R2, working tree limpa (incluindo arquivos novos), stage vazio e origin/main correspondente.
- Atestar SHA-256 dos arquivos do ZIP, hashes dos arquivos originais contra origin/main, backup restaurável.
- Nova suíte R226, TypeScript e pré-APK completo; `git diff --check`; inventário seletivo exato; segundo fetch remoto.
- Commit/push seletivo sem force somente após todos os gates. Em falhas antes do commit, rollback seletivo.

## Homologação física rápida
1. Montar compras; tocar voltar com rascunho: modal não corta e preserva seleção.
2. Abrir cadastro de compra, selecionar produto, criar fornecedor, abrir categoria com teclado: cabeçalho e botões visíveis, rolagem funcional.
3. Trocar produtos entre linhas e conferir que duplicidade de seleção continua bloqueada.
4. Criar UMA compra de teste e conferir no histórico; não usar uma compra fictícia em produção real.
5. Rota: abrir “Mover/Fixar”, baixa, fechar rota. Verificar diferenças entre estados pendente/confirmado.
6. Loja/Site → Caixa de Entrada: pedido não cai automaticamente numa rota.
7. Diagnóstico → tempos locais: amostra da operação em segundos. Não confundir P90 com prova de latência do Firebase.
8. Se uma gravação demora, não pressionar repetidamente; primeiro verificar estado real e o histórico no outro aparelho.

**Não anuncia o app como offline-first de baixa/crédito totalmente transacional.** Transações do Firestore continuam exigindo confirmação remota; a arquitetura de outbox durável deve ser homologada com dois dispositivos antes de ativação.
