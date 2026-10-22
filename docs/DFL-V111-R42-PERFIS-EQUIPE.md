# DFL V111 R42 — Perfis e acesso por área (preparação, não produção)

## Perfis disponíveis

| Perfil | Visão futura | Solicitações possíveis | Restrições |
|---|---|---|---|
| Motoboy | Início, suas rotas e entregas | Conferir entrega (pendente de aceite do dono) | Exige motoboy vinculado. Nada de estoque/compras. |
| Compras | Início, estoque e compras | Solicitar lançamento de compra (sem registrar entrada) | Nada de rotas, entregas ou financeiro. |
| Operação | Início, visão limitada das rotas/entregas, estoque e compras | Apenas o que o dono selecionar e vincular | Projeções minimizadas: máximo 30 rotas, 40 entregas, 30 produtos e 30 compras. |
| Personalizado | Somente áreas escolhidas | Solicitações conforme permissões e vínculos | Logística exige motoboy vinculado. |

Uma permissão cadastrada não equivale à funcionalidade publicada. `stock_write`, `routes_create`, `deliveries_create` ainda não disparam escrita efetiva pelo portal. `purchases_write` só cria solicitação para aceite do proprietário, não compra automaticamente. Operação sem vínculo pode **consultar projeções limitadas** de logística, mas não finalizar entregas; o pedido de conclusão exige um motoboy vinculado e os controles canônicos existentes.

## O que a R42 instala
- Prévia das áreas acessíveis e bloqueadas no formulário do proprietário, sem leituras adicionais.
- Operação visualiza uma amostra limitada de rotas e entregas no gerador de projeção, mantendo whitelist e consultas limitadas.
- Personalizado com logística exige vínculo individual em runtime, política de sincronização e Rules **candidatas de emulador**.
- UI do funcionário não oferece solicitar conclusão sem motoboy vinculado.
- Indicador de compras abertas no Estoque memoizado.
- Testes dos quatro perfis e do Firestore projetado.

## Passos para homologar futuramente
1. Cadastrar funcionário com **nome + e-mail Google** (Operação, Compras, Motoboy ou Personalizado).
2. Selecionar permissões e vínculos; conferir a **prévia**, que não altera nenhuma permissão no Firebase.
3. Fazer teste de login com conta Google em domínio isolado e coleta do pedido R41 (exige configuração prévia das flags de homologação).
4. Revisar o vínculo no painel de Homologação; manter conta suspensa.
5. Executar Rules candidatas e API no **Firebase Emulator em projeto demo**, com testes para cada função, revogação e tentativa de acesso indevido.
6. Após autorização explícita do proprietário, planejar publicação e regras restritas, com rollback. **R42 não faz esses passos por você.**

A produção segue com Rules OWNER-ONLY e nenhuma nova flag ativada. Este pacote não executa commit, push, deploy, migrações ou acionamento da Action.
