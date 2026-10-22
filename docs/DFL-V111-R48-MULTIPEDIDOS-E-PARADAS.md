# DFL Entregas V111 — R48

## Nova Entrega e Editar Entrega consistentes

- Criação mostra abas `#pedido` quando há mais de um pedido na mesma parada.
- Cada aba edita seu conjunto de campos sem sobrescrever o pedido irmão: ID iFood, código de confirmação, cliente/WhatsApp, endereço/Maps, valor, cupom, pagamento, troco, bebidas e observações.
- Rota é compartilhada pela operação; endereço é reaproveitado ao adicionar, mas pode ser ajustado por pedido.
- `Salvar N pedidos` grava uma vez após validação completa. Número/ID duplicados, código incorreto e valor ausente selecionam a aba com falha.
- Novo pedido não herda número, ID, código ou preço; cliente e endereço são sugeridos, editáveis.
- Pedidos de um mesmo endereço compartilham `stop_group_id` inclusive se adicionados a uma parada já existente. Endereços divergentes não compartilham automaticamente grupo.
- Card da parada não recicla o último código de confirmação do cliente como se fosse o código atual. Cada pedido exibe seu código quando disponível.
- Cliente na edição de cada aba continua independente; a atualização é executada pelo fluxo preexistente `findOrCreateCustomer`/`addDeliveries`.

## Limites

- R48 não altera Firestore Rules, coleção, API, flags, contas nem modelo financeiro.
- R48 não autoriza publicação nem ativa o portal de funcionários; Emulator real ainda precisa ser executado.
- TypeScript integral, PRE-APK e verificação Git bloqueiam a instalação no Termux.
