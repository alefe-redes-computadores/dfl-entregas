# DFL V111 R64 — SOLICITACAO GOOGLE ATOMICA E HOMOLOGACAO

## Correção real

- O servidor verifica **dentro da transação** o convite atual, a conta e o pedido de vínculo.
- Convites suspensos, alterados ou revogados deixam de gerar pedidos pendentes após a mudança.
- Uma solicitação pendente repetida é idempotente; um pedido já revisado **não renasce** como pendente.
- Identidade verificada pelo Firebase Auth (login Google) continua obrigatória, com domínio isolado.
- Nenhuma solicitação ativa uma conta automaticamente.

## Matriz de homologação

Dois cenários independentes na Action **manual** `.github/workflows/dfl-r64-staff-emulator.yml`:
1. Rules owner-only: funcionário não acessa nem a própria projeção.
2. Rules candidatas: Motoboy vê somente projeções de rotas/entregas; Compras, apenas estoque/compras; Operação e Personalizado continuam nas regras da matriz anterior. Teste novo cobre escrita indevida, elevação de papel, acesso raiz, limite 40 e revogação.

A Action é apenas um teste futuro: **não foi executada pelo instalador**, não altera Rules de produção, não libera usuários, não faz deploy.

## Pendências para o primeiro teste humano

- Publicar primeiro o lote local revisado no GitHub por autorização explícita.
- Executar e revisar o log real da Action no GitHub; confirmar requisitos atuais de isolamento e domínio.
- Revisar regras candidatas e efetuar qualquer mudança em produção somente após consentimento explícito.
- Validar segunda conta Google em outro dispositivo e suspensão imediata.

As permissões permanecem bloqueadas e o proprietário continua como único usuário da produção.
