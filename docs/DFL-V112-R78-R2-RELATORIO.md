# V112 R78-R2 — Cirurgia global UX mobile e regressões

Base: R77 fcfa677. Mantém: R75/76/77, Site, iFood, 99Food, financeiro, compras, Firestore e notificações.

- Corrigido V103, sem apagar o contrato: seta Android exige trava, limites e escrita única.
- Adicionados testes comportamentais com implementação real do motor da parada física: 2 pedidos = 1 parada, subir/descer, posição fixada e concluídos.
- Card compacto: origem em faixa fina e etiqueta; melhora leitura de valores pequenos/grandes.
- Card expandido: setas, folha Mover, Fixar/Destravar e Minimizar explícito. Abas/ordem não fecham outras entregas.
- Loja: Compras e Estoque permanentes fora da Gestão recolhível.
- Relatórios: substituído segundo gráfico redundante de origem por comparação compacta e acessível de 3 canais. Primeiro gráfico e drill-down permanecem. ReportChartCard reduz altura no smartphone, com valores quebráveis.
- Auditoria preventiva: contratos de notificações/estoque/motoboy mantidos sem modificar os pipelines — nada de permissões ou listeners extras, push somente após PRE-APK completo.
- Pesquisa de referência: Onfleet Driver e DeliveryRoute mostram o valor de ações contextualizadas de sequência, navegação, telefone e histórico; adotada a hierarquia compacta, sem novos provedores ou dependências.

Todos os arquivos alterados sob backup/rollback seletivo. Sem atualização de esquema Firestore nem migração de dados.
