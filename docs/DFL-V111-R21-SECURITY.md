# DFL Entregas V111 R21 — Fundacao segura de Equipe e Permissoes

## O que ja fica funcional
- Central do superadministrador em `Mais > Equipe e permissoes`.
- Cadastrar, editar, pesquisar, configurar grupos/permissoes, associar cadastro
  operacional de integrante ou motoboy, suspender e retomar RASCUNHOS.
- Persistencia direta no Firestore (`staff_access_drafts`) e trilha de alteracao
  (`staff_access_audit`) em lote atomico com verificacao do UID autenticado.
- Login de outras contas permanece NEGADO no cliente. Inicializacao, notificacao
  de pedidos, automacoes de loja e fechamento de rotas nao devem iniciar antes
  de autenticar o superadministrador.
- Tres endpoints administrativos com verificador de UID, nao so de e-mail.
- PRE-APK com contrato de seguranca para evitar regressao.

## O que NAO fica habilitado na R21
- NENHUM funcionario pode fazer login operacional ainda. Registros sao
  rascunhos e o campo `activation: not_enabled` nao pode ser alterado na UI.
- Nao publica/afrouxa regras do Firebase Console.
- Nao muda o projeto Firebase nem o backend do Site.
- Nao cria token de convite nem confunde e-mail com credencial.

## Por que e necessario implementar a R22 antes de ligar funcionarios
`useAppStore.initData()` carrega colecoes completas, incluindo valores e
informacoes de clientes. O Firestore Security Rules nao faz redacao de campos.
Habilitar motoboy ou compras com acesso amplo a uma colecao seria vazamento.
O modo de funcionario exigira projecoes de documentos SEM dados proibidos,
consultas estritamente por dono/rota/atribuicao, controles do Firestore para
get/list/create/update/delete e APIs com autorizacao servidor por acao.

## Plano R22 recomendado
1. Criar visoes/projecoes por papel com minimizacao de campos sensiveis.
2. Vincular o UID verificado do login a um cadastro de acesso, com revogacao.
3. Carregar so consultas autorizadas; impedir inicializacao global para equipe.
4. Separar dados financeiro/clientes/dados operacionais. Motoboy ve somente
   rotas/entregas atribuidas a seu motoboy_id, nao todas as entregas.
5. Regras versionadas em revisao, testadas no emulador: usuario anonimo,
   operador suspenso, operador de compras, motoboy, dono, acesso direto, queries
   amplas, escrita de campos proibidos, cross-tenant e movimentacao de estoque.
6. Publicar regras com checklist de rollback; testar admin primeiro, depois
   usuario de homologacao. NAO criar `allow read: if request.auth != null`.
7. Auditar Firebase Admin SDK/APIs: o Admin SDK ignora Firestore Rules.
8. Isolar cache IndexedDB/Zustand por UID antes da primeira conta compartilhada.

## Diferenca entre equipe operacional e acessos
`app/equipe` e o cadastro de pessoas e motoboys para operacao. A nova
central administra rascunhos de identidades e capacidades. Vincular um item
NAO concede permissao ao dono desse nome ou e-mail.
