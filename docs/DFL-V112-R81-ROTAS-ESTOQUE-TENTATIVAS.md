# DFL Entregas V112 R81 — interação operacional

Base: R80 `7ae57e1d3c62c47ad83626bd159ee4f9dcfc2711`.

- Identidade comercial na coluna esquerda: nome da origem vertical centralizado abaixo do ícone; selo horizontal removido para liberar nome e preço. iFood vermelho, 99Food amarelo, Site azul, Loja verde, Misto roxo.
- Arraste manual removido do DOM e do componente React: no Android mantenha setas ↑↓, Fixar/Destravar, Mover para…, Ir primeiro e Deixar por último. Sem captura de pointer nem RAF de arraste. Swipe horizontal de expandir/baixar permanece intocado.
- Representante de parada com pedidos mistos passa a ser o primeiro *pendente*, não o primeiro histórico (que pode ter sido baixado). Grupos continuam íntegros.
- Card de produto da tela Estoque é clicável para movimentação; título abre Detalhes de produto e botão à direita preserva Movimentar. Acessível por teclado.
- Novo histórico limitado a 50 registros de tentativas por pedido em `delivery_attempts`, com motivo, observação e data/ID. Sem assumir entrega concluída, pagamento, cancelamento ou confirmação iFood. Tentativa pode opcionalmente mover parada por API existente; falha ao mover não apaga a tentativa salva. Seleção do pedido quando a parada tem mais de uma entrega pendente. Não reescreve histórico anterior.
- Testes de regressão legados atualizados para o modelo de setas sem alça, sem enfraquecer invariantes de rota/estoque e sem novas leituras Firestore.
- TypeScript, suítes executáveis, PRE-APK e `git diff --check` são barreiras para publicação automática. Somente manifesto R81 entra no GitHub; `.orig`/backups não.
