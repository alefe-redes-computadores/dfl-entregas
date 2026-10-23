# DFL V112 R78 — Reordenação no Android, expansão estável e canais visuais

Base verificada: fcfa677 (R77). Sem mudanças no Firebase, Firestore, contratos de entrega, mutações financeiras ou integrações externas.

- Setas subir/descer novamente visíveis em celulares. Apenas paradas pendentes de rotas abertas; paradas fixadas precisam ser destravadas. Continua disponível Mover/Fixar e a autoridade moveDeliveryToIndex.
- Expansão não fecha outros cards, não é reinicializada e não recolhe por toque acidental no conteúdo. Botão visível Minimizar faz o fechamento explícito.
- Card recebe filete vertical e badge com Lucide em caixa alta. iFood vermelho, 99Food amarelo, DFL Site azul, Loja verde. Pedidos de WhatsApp/Instagram/telefone/presencial NÃO viram nova origem, são Loja. Grupo de origens diferentes aparece MISTO.
- Loja: Compras e Estoque permanecem fora da Gestão recolhível e visíveis, preservando Equipe/Clientes/Despesas/iFood.
- Não reordena entregas concluídas nem rotas encerradas. Mantém 1 parada para multi-pedidos no mesmo endereço.
- Garantias R78 incorporadas no PRE-APK existente, sem remover suítes antigas. Commit/push ocorre somente após a validação integral.
