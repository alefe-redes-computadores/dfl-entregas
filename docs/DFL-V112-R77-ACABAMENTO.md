# DFL V112 R77 — Acabamento final e guarda de regressão

Base: R76-R2 e9b0483. Nenhuma regra Firestore, migração, alteração de ledger ou servidor alterados.

## Cirurgia

- Home: não considera endereço com rua e número um erro só porque não tem link GPS. Direciona ao pedido específico e identifica cliente/pedido na ação.
- Clientes: busca suave com consultas adiadas na interface, resultados mostrando o telefone/endereço correspondente, modal com seleção acessível e reinicialização entre clientes.
- Contatos: dois endereços textualmente iguais mas em bairros diferentes são distintos; duplicados no mesmo bairro continuam deduplicados.
- Ficha do cliente: histórico progressivo de 24 em 24, lookup de rota via Map, links Maps para todos os endereços.
- Loja: memoriza expansão de Gestão por sessão sem salvar preferências no Firestore e sem quebrar privacidade; conteúdo conserva atalhos de negócio originais.
- Relatórios: texto esclarece vendas 99Food realizadas pela plataforma e corrigido footer de compras.
- Clientes mobile: formulários e botões responsivos, métricas com nomes corretos.

## Release

PRE-APK completo + TypeScript no Termux são obrigatórios; commit seletivo/push só quando todas as suítes passam. Se falhar, restaura apenas arquivos do manifesto. Arquivo .orig previamente presente continua intocado. APK/UX exigem teste real Android após publicação.
