# DFL V111 — R57: autoridade do código por pedido

A Central e o fechamento da rota da R53 já usam o código específico de cada pedido. A R57 estende esta autoridade para:
- Ficha da entrega e conclusão: código histórico do cliente nunca preenche confirmação, link ou baixa de novo pedido.
- Checklists de saída (modal e card de rota): só validam exatamente 4 dígitos presentes na própria entrega.
- Edição: selecionar um cliente não injeta o último código dele na entrega editada. Código salvo da entrega ainda aparece ao carregar.
- Utilitário iFood central: mesmo que um chamador passe o histórico, a confirmação só é `ready` com código válido da entrega.
- Portal de confirmação: proteção síncrona contra cliques concorrentes em sucesso e código inválido, rechecagem de pendência, vibração Android não bloqueante e cópia com tratamento de erro.

Código histórico no cadastro do cliente permanece disponível **como referência histórica**, sem validar pedidos futuros.

R57 é local, preserva as Rules owner-only, não habilita funcionários, não realiza commit/push/deploy.
